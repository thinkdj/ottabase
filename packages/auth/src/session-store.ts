// ============================================================
// @ottabase/auth - Session Store (signed JWT + KV registry)
// ============================================================
//
// Sessions are a signed, self-contained JWT cookie (no DB read needed to
// validate a request) paired with a lightweight KV registry record keyed
// by the session id ("jti"). The registry record is what makes sign-out
// immediate and precise:
//
//   - Deleting the one session's registry key revokes *that* session only
//     (used by normal sign-out).
//   - A separate "revoked since <timestamp>" KV key can invalidate every
//     session for a user at once (used by password change/reset).
//
// Both checks are single KV reads on the request hot path, so the request
// overhead is unchanged from a plain JWT-only design.
//
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { userKey } from '@ottabase/cf/cache-keys';
import { registerConnection } from '@ottabase/ottaorm';
import { OrganizationMember, User } from '@ottabase/ottaorm/models';
import { SYSTEM_ORGANIZATION_ID, parseBooleanFlag } from './bootstrap';
import { clearCookie, isHttpsRequest, parseCookies, serializeCookie } from './cookies';
import { signJwt, verifyJwt } from './jwt';
import type { AuthEnv, CreateAuthConfigOptions, Session, SessionTokenPayload, SessionUser } from './types';

export const SESSION_COOKIE_DEFAULT = 'ottabase.session-token';
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function resolveSessionCookieName(env: AuthEnv): string {
    return env.AUTH_COOKIE_NAME || SESSION_COOKIE_DEFAULT;
}

export function resolveSessionMaxAge(env: AuthEnv, options?: CreateAuthConfigOptions): number {
    if (options?.sessionMaxAge && options.sessionMaxAge > 0) return options.sessionMaxAge;
    const envMaxAge = Number(env.AUTH_SESSION_MAX_AGE);
    if (Number.isFinite(envMaxAge) && envMaxAge > 0) return envMaxAge;
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
}

/**
 * Resolve the HMAC secret used to sign session/CSRF/OAuth-state tokens.
 * Required in production; falls back to an insecure default (with a warning) elsewhere.
 */
export function resolveAuthSecret(env: AuthEnv): string {
    if (env.AUTH_SECRET) return env.AUTH_SECRET;

    const environment = (env.ENVIRONMENT || '').toLowerCase();
    const isProduction = environment !== '' && !['development', 'dev', 'test'].includes(environment);

    if (isProduction) {
        throw new Error('AUTH_SECRET is required in production');
    }

    console.warn('[auth] AUTH_SECRET is not configured. Using an insecure default -- do not deploy this way.');
    return 'dev-secret-change-in-production';
}

function ensureOrmConnection(env: AuthEnv): void {
    if (!env.OBCF_D1) return;
    registerConnection('default', createD1Driver(env.OBCF_D1));
}

function sessionRegistryKey(userId: string, jti: string): string {
    return userKey('auth', userId, 'sess', jti);
}

function revokedSinceKey(userId: string): string {
    return userKey('auth', userId, 'revoked');
}

function profileVersionKey(userId: string): string {
    return userKey('auth', userId, 'profile', 'version');
}

interface UserContext {
    organizationId: string | null;
    roles: string[];
    permissions: string[];
    createdAt: number | null;
}

/**
 * Resolve a user's active organization, org-scoped roles/permissions, and creation
 * timestamp -- computed once at session-creation time and embedded in the JWT.
 * (Real authorization decisions are re-checked live per-request by `@ottabase/rbac`;
 * this snapshot only drives optimistic client-side UI gating.)
 */
async function loadUserContext(userId: string, env: AuthEnv): Promise<UserContext> {
    ensureOrmConnection(env);

    let organizationId: string | null = null;
    try {
        const memberships = await OrganizationMember.where(
            { userId, status: 'active' },
            { orderBy: 'joinedAt', orderDirection: 'asc', limit: 1 },
        );
        if (memberships[0]) {
            organizationId = String(memberships[0].get('organizationId') || '') || null;
        }
    } catch {
        // Membership table may not exist yet (pre-migration) -- treat as no organization.
    }

    const allowNullTenant = parseBooleanFlag(env.ALLOW_NULL_TENANT);
    if (!organizationId && allowNullTenant && env.OBCF_D1) {
        try {
            const systemRole = await env.OBCF_D1.prepare(
                `SELECT 1 FROM user_roles WHERE user_id = ? AND organization_id = ? LIMIT 1`,
            )
                .bind(userId, SYSTEM_ORGANIZATION_ID)
                .first<any>();
            if (systemRole) organizationId = SYSTEM_ORGANIZATION_ID;
        } catch {
            // Ignore -- fall through with no organization.
        }
    }

    let roles: string[] = [];
    let permissions: string[] = [];
    let createdAt: number | null = null;

    try {
        const user = await User.find(userId);
        if (user) {
            if (organizationId) {
                const roleRecords = await user.roles({ organizationId });
                roles = roleRecords.map((role: { get: (key: string) => unknown }) => String(role.get('name')));
                permissions = await user.getPermissions({ organizationId });
            }
            const createdAtRaw = user.get('createdAt');
            if (createdAtRaw) {
                const parsed = createdAtRaw instanceof Date ? createdAtRaw.getTime() : new Date(String(createdAtRaw)).getTime();
                createdAt = Number.isFinite(parsed) ? parsed : null;
            }
        }
    } catch (error) {
        console.warn('Failed to load user roles/permissions for session:', error);
    }

    return { organizationId, roles, permissions, createdAt };
}

export interface CreateSessionInput {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: number | null;
    /** Skip organization/role lookup and use these values verbatim (e.g. bootstrap auto-login). */
    organizationId?: string | null;
    roles?: string[];
    permissions?: string[];
}

export interface CreatedSession {
    token: string;
    jti: string;
    expiresAt: number;
    user: SessionUser;
}

/** Create a new signed session for a user, registering it in the KV revocation registry. */
export async function createSessionForUser(
    input: CreateSessionInput,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<CreatedSession> {
    const context =
        input.organizationId !== undefined && input.roles !== undefined && input.permissions !== undefined
            ? { organizationId: input.organizationId, roles: input.roles, permissions: input.permissions, createdAt: null }
            : await loadUserContext(input.id, env);

    const maxAgeSeconds = resolveSessionMaxAge(env, options);
    const jti = crypto.randomUUID();
    const secret = resolveAuthSecret(env);

    let profileVersion = 0;
    if (env.OBCF_KV) {
        try {
            const versionRaw = await env.OBCF_KV.get(profileVersionKey(input.id));
            profileVersion = Number(versionRaw || 0) || 0;
        } catch {
            // Non-fatal; profile-version sync is a best-effort cache-busting mechanism.
        }
    }

    const payload: SessionTokenPayload = {
        sub: input.id,
        jti,
        email: input.email,
        name: input.name ?? null,
        image: input.image ?? null,
        emailVerified: input.emailVerified ?? null,
        organizationId: context.organizationId,
        roles: context.roles,
        permissions: context.permissions,
        createdAt: context.createdAt,
        profileVersion,
    };

    const token = await signJwt(payload, secret, { expiresInSeconds: maxAgeSeconds });
    const expiresAt = Date.now() + maxAgeSeconds * 1000;

    if (env.OBCF_KV) {
        try {
            await env.OBCF_KV.put(sessionRegistryKey(input.id, jti), String(Date.now()), {
                expirationTtl: maxAgeSeconds,
            });
        } catch (error) {
            console.warn('Failed to register session in KV:', error);
        }
    }

    return {
        token,
        jti,
        expiresAt,
        user: {
            id: input.id,
            email: input.email,
            name: payload.name,
            image: payload.image,
            emailVerified: payload.emailVerified,
            organizationId: payload.organizationId,
            roles: payload.roles,
            permissions: payload.permissions,
            createdAt: payload.createdAt,
        },
    };
}

export function buildSessionCookie(token: string, env: AuthEnv, request: Request, maxAgeSeconds: number): string {
    return serializeCookie(resolveSessionCookieName(env), token, {
        maxAgeSeconds,
        secure: isHttpsRequest(request),
        sameSite: 'Lax',
        httpOnly: true,
    });
}

export function buildClearSessionCookie(env: AuthEnv, request: Request): string {
    return clearCookie(resolveSessionCookieName(env), { secure: isHttpsRequest(request) });
}

/**
 * Create a session and return the ready-to-use `Set-Cookie` header value.
 * Used both by the normal sign-in handlers and by system-initiated logins
 * (e.g. the first-run owner-account bootstrap wizard).
 */
export async function createSessionCookieForUser(
    input: CreateSessionInput,
    env: AuthEnv,
    request: Request,
    options?: CreateAuthConfigOptions,
): Promise<{ cookie: string; session: CreatedSession }> {
    const maxAgeSeconds = resolveSessionMaxAge(env, options);
    const session = await createSessionForUser(input, env, options);
    return { cookie: buildSessionCookie(session.token, env, request, maxAgeSeconds), session };
}

async function refreshProfileIfStale(user: SessionUser, payload: SessionTokenPayload, env: AuthEnv): Promise<SessionUser> {
    if (!env.OBCF_KV || !env.OBCF_D1) return user;

    try {
        const versionRaw = await env.OBCF_KV.get(profileVersionKey(user.id));
        if (!versionRaw) return user;

        const version = Number(versionRaw);
        const tokenVersion = Number(payload.profileVersion || 0);
        if (!Number.isFinite(version) || version <= tokenVersion) return user;

        ensureOrmConnection(env);
        const dbUser = await User.find(user.id);
        if (!dbUser) return user;

        const emailVerifiedRaw = dbUser.get('emailVerified');
        const emailVerified = emailVerifiedRaw
            ? emailVerifiedRaw instanceof Date
                ? emailVerifiedRaw.getTime()
                : Number(emailVerifiedRaw)
            : null;

        return {
            ...user,
            name: (dbUser.get('name') as string | null) ?? user.name,
            email: (dbUser.get('email') as string) ?? user.email,
            image: dbUser.get('image') !== undefined ? (dbUser.get('image') as string | null) : user.image,
            emailVerified: Number.isFinite(emailVerified as number) ? emailVerified : user.emailVerified,
        };
    } catch (error) {
        console.warn('Failed to refresh profile from KV version:', error);
        return user;
    }
}

/**
 * Resolve the current session from a request's cookies.
 *
 * Fast path: JWT signature + expiry check, plus up to two KV reads
 * (bulk revocation timestamp + per-session registry). No database read
 * unless a profile-version bump flags the cached fields as stale.
 */
export async function getSession(request: Request, env: AuthEnv, options?: CreateAuthConfigOptions): Promise<Session | null> {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies[resolveSessionCookieName(env)];
    if (!token) return null;

    let payload: SessionTokenPayload | null;
    try {
        payload = await verifyJwt<SessionTokenPayload>(token, resolveAuthSecret(env));
    } catch {
        return null;
    }
    if (!payload || !payload.sub || !payload.jti) return null;

    if (env.OBCF_KV) {
        try {
            const revokedAtRaw = await env.OBCF_KV.get(revokedSinceKey(payload.sub));
            if (revokedAtRaw) {
                const revokedAt = Number(revokedAtRaw);
                const issuedAt = Number(payload.iat || 0);
                if (Number.isFinite(revokedAt) && issuedAt > 0 && issuedAt <= revokedAt) return null;
            }
        } catch {
            // Fail open on transient KV errors, matching prior behavior.
        }

        try {
            const registryRecord = await env.OBCF_KV.get(sessionRegistryKey(payload.sub, payload.jti));
            if (!registryRecord) return null;
        } catch {
            // Fail open on transient KV errors.
        }
    }

    let user: SessionUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name ?? null,
        image: payload.image ?? null,
        emailVerified: payload.emailVerified ?? null,
        organizationId: payload.organizationId ?? null,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
        createdAt: payload.createdAt ?? null,
    };

    user = await refreshProfileIfStale(user, payload, env);

    void options; // reserved for future per-call overrides; kept for API-shape parity with createAuthConfig

    return { user, expires: (payload.exp ?? 0) * 1000 };
}

/** Revoke a single session (used by normal sign-out). */
export async function revokeSession(userId: string, jti: string, env: AuthEnv): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        await env.OBCF_KV.delete(sessionRegistryKey(userId, jti));
    } catch (error) {
        console.warn('Failed to revoke session:', error);
    }
}

/** Revoke every session for a user (used by password change/reset). */
export async function revokeAllUserSessions(userId: string, env: AuthEnv, options?: CreateAuthConfigOptions): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        const maxAgeSeconds = resolveSessionMaxAge(env, options);
        await env.OBCF_KV.put(revokedSinceKey(userId), String(Math.floor(Date.now() / 1000)), {
            expirationTtl: maxAgeSeconds,
        });
    } catch (error) {
        console.warn('Failed to revoke sessions:', error);
    }
}
