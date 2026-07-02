// ============================================================
// @ottabase/auth - Session Store (signed JWT + KV registry)
// ============================================================
//
// A session is a signed, self-contained JWT cookie holding only the
// user's IDENTITY (sub, jti, email, and small display fields). The
// mutable authorization SNAPSHOT (organization, roles, permissions) is
// stored in a per-session KV "registry" record keyed by the session id
// ("jti"), NOT in the cookie -- so the cookie can never exceed the ~4KB
// browser limit no matter how many permissions a user has, and revoked
// roles do not linger in a signed token for the session's whole lifetime.
//
// Revocation is a deny-list, which is the KV-appropriate primitive under
// eventual consistency:
//
//   - Single sign-out writes a per-session tombstone (`revoked:{jti}`)
//     and drops the registry record.
//   - Bulk revoke (password change/reset) writes a "revoked since <ms>"
//     marker for the user; any session created before it is rejected.
//
// The per-session registry record is an allow-list snapshot cache. A
// freshly-issued session may land on a colo that has not yet seen the
// registry write (KV is eventually consistent across colos), so within a
// short issued-at GRACE window a missing registry record is tolerated and
// self-healed from the database instead of bouncing the user back to
// login. Past the grace window a missing record means the session was
// signed out / expired and is rejected.
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

export const SESSION_COOKIE_BASE = 'ottabase.session-token';
/** @deprecated use SESSION_COOKIE_BASE / resolveSessionCookieName */
export const SESSION_COOKIE_DEFAULT = SESSION_COOKIE_BASE;
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * How long after a session's `iat` a MISSING registry record is tolerated,
 * to absorb KV cross-colo propagation delay (read-your-write is only
 * guaranteed at the writing colo). Kept well under a minute; revocation
 * tombstones are still honored inside this window.
 */
const REGISTRY_GRACE_SECONDS = 120;

const DEV_ENVIRONMENTS = new Set(['development', 'dev', 'test', 'local']);

/** Environments explicitly marked as non-production dev/test. Unset ENVIRONMENT is NOT dev. */
export function isDevEnvironment(env: AuthEnv): boolean {
    return DEV_ENVIRONMENTS.has((env.ENVIRONMENT || '').trim().toLowerCase());
}

/**
 * Whether to treat this deployment as production for COOKIE hardening (Secure +
 * __Host- prefix). Only an explicit non-dev ENVIRONMENT counts, so local dev over
 * plain HTTP (ENVIRONMENT unset) still works. Note this is deliberately the OPPOSITE
 * default from `resolveAuthSecret`, whose secret must fail CLOSED on an unknown env.
 */
export function isProductionCookieEnv(env: AuthEnv): boolean {
    const environment = (env.ENVIRONMENT || '').trim().toLowerCase();
    return environment !== '' && !DEV_ENVIRONMENTS.has(environment);
}

/** In production, force Secure regardless of proxy headers; elsewhere follow the actual scheme. */
export function resolveSecureCookie(env: AuthEnv, request: Request): boolean {
    return isProductionCookieEnv(env) || isHttpsRequest(request);
}

export function resolveSessionCookieName(env: AuthEnv): string {
    const configured = env.AUTH_COOKIE_NAME;
    if (configured) return configured;
    // __Host- pins the cookie to the exact host over HTTPS with Path=/ and no Domain,
    // preventing subdomain cookie-tossing / fixation. Only valid with Secure, so only
    // applied when we know we are production (always-Secure) to avoid breaking dev HTTP.
    return `${isProductionCookieEnv(env) ? '__Host-' : ''}${SESSION_COOKIE_BASE}`;
}

export function resolveSessionMaxAge(env: AuthEnv, options?: CreateAuthConfigOptions): number {
    if (options?.sessionMaxAge && options.sessionMaxAge > 0) return options.sessionMaxAge;
    const envMaxAge = Number(env.AUTH_SESSION_MAX_AGE);
    if (Number.isFinite(envMaxAge) && envMaxAge > 0) return envMaxAge;
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
}

/**
 * Resolve the HMAC secret used to sign session/CSRF/OAuth-state tokens.
 *
 * Fails CLOSED: the insecure development default is only ever used when ENVIRONMENT
 * is explicitly a known dev value. An unset/unknown ENVIRONMENT is treated as
 * production, so a real deploy that forgets to set AUTH_SECRET throws instead of
 * silently signing every token with a publicly-known constant.
 */
export function resolveAuthSecret(env: AuthEnv): string {
    if (env.AUTH_SECRET) {
        if (env.AUTH_SECRET.length < 16) {
            throw new Error('AUTH_SECRET is too short; use at least 32 random characters (e.g. `openssl rand -base64 32`)');
        }
        return env.AUTH_SECRET;
    }

    // The well-known insecure default is only ever used when BOTH an explicit dev
    // ENVIRONMENT and an explicit opt-in flag are set. This double gate means a deploy
    // that merely declares ENVIRONMENT=development in its wrangler vars (or forgets to set
    // ENVIRONMENT at all) still fails closed instead of silently signing every token with
    // a publicly-known constant.
    const allowInsecure = isDevEnvironment(env) && parseBooleanFlag(env.AUTH_ALLOW_INSECURE_DEV_SECRET);
    if (!allowInsecure) {
        throw new Error(
            'AUTH_SECRET is required (set it via `wrangler secret put AUTH_SECRET`). ' +
                'To use the insecure default locally, set ENVIRONMENT to a dev value AND AUTH_ALLOW_INSECURE_DEV_SECRET=true.',
        );
    }

    console.warn('[auth] AUTH_SECRET is not configured. Using an insecure development default -- never deploy this way.');
    return 'dev-secret-change-in-production';
}

function ensureOrmConnection(env: AuthEnv): void {
    if (!env.OBCF_D1) return;
    registerConnection('default', createD1Driver(env.OBCF_D1));
}

function sessionRegistryKey(userId: string, jti: string): string {
    return userKey('auth', userId, 'sess', jti);
}

function revokedJtiKey(userId: string, jti: string): string {
    return userKey('auth', userId, 'revoked-jti', jti);
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

/** The mutable snapshot stored in the KV registry record (kept out of the cookie). */
interface RegistrySnapshot {
    /** createdMs -- session creation time in epoch ms (used for bulk-revocation comparison). */
    c: number;
    /** profile version this snapshot reflects. */
    v: number;
    organizationId: string | null;
    roles: string[];
    permissions: string[];
    createdAt: number | null;
}

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

async function readProfileVersion(userId: string, env: AuthEnv): Promise<number> {
    if (!env.OBCF_KV) return 0;
    try {
        const raw = await env.OBCF_KV.get(profileVersionKey(userId));
        const parsed = Number(raw || 0);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
}

async function writeRegistrySnapshot(
    userId: string,
    jti: string,
    snapshot: RegistrySnapshot,
    maxAgeSeconds: number,
    env: AuthEnv,
): Promise<void> {
    if (!env.OBCF_KV) return;
    await env.OBCF_KV.put(sessionRegistryKey(userId, jti), JSON.stringify(snapshot), {
        expirationTtl: maxAgeSeconds,
    });
}

/**
 * Create a new signed session for a user, registering its snapshot in the KV registry.
 *
 * The registry write is REQUIRED and fails loudly: a session whose registry record is
 * missing cannot be validated after the grace window, so silently issuing a cookie
 * whose prerequisite failed to persist would strand the user in a login loop.
 */
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
    const profileVersion = await readProfileVersion(input.id, env);
    const createdMs = Date.now();

    // The cookie JWT carries only identity + small display fields. Roles/permissions
    // (potentially large / frequently changing) live in the registry snapshot below.
    const payload: SessionTokenPayload = {
        sub: input.id,
        jti,
        email: input.email,
        name: input.name ?? null,
        image: input.image ?? null,
        emailVerified: input.emailVerified ?? null,
        organizationId: context.organizationId,
        createdAt: context.createdAt,
        profileVersion,
    };

    const token = await signJwt(payload, secret, { expiresInSeconds: maxAgeSeconds });
    const expiresAt = createdMs + maxAgeSeconds * 1000;

    const snapshot: RegistrySnapshot = {
        c: createdMs,
        v: profileVersion,
        organizationId: context.organizationId,
        roles: context.roles,
        permissions: context.permissions,
        createdAt: context.createdAt,
    };

    if (env.OBCF_KV) {
        try {
            await writeRegistrySnapshot(input.id, jti, snapshot, maxAgeSeconds, env);
        } catch (error) {
            // Retry once, then fail the sign-in: fail-closed must be end-to-end.
            try {
                await writeRegistrySnapshot(input.id, jti, snapshot, maxAgeSeconds, env);
            } catch (retryError) {
                console.error('Failed to persist session registry record:', retryError);
                throw new Error('Failed to persist session; sign-in aborted');
            }
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
            organizationId: context.organizationId,
            roles: context.roles,
            permissions: context.permissions,
            createdAt: context.createdAt,
        },
    };
}

export function buildSessionCookie(token: string, env: AuthEnv, request: Request, maxAgeSeconds: number): string {
    return serializeCookie(resolveSessionCookieName(env), token, {
        maxAgeSeconds,
        secure: resolveSecureCookie(env, request),
        sameSite: 'Lax',
        httpOnly: true,
    });
}

export function buildClearSessionCookie(env: AuthEnv, request: Request): string {
    return clearCookie(resolveSessionCookieName(env), { secure: resolveSecureCookie(env, request) });
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

function parseSnapshot(raw: string | null): RegistrySnapshot | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<RegistrySnapshot>;
        if (typeof parsed !== 'object' || parsed === null) return null;
        return {
            c: Number(parsed.c) || 0,
            v: Number(parsed.v) || 0,
            organizationId: parsed.organizationId ?? null,
            roles: Array.isArray(parsed.roles) ? parsed.roles : [],
            permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
            createdAt: parsed.createdAt ?? null,
        };
    } catch {
        return null;
    }
}

/** Refresh a stale snapshot (profile/role change) from D1 exactly once, rewriting the registry record. */
async function refreshSnapshotIfStale(
    userId: string,
    jti: string,
    snapshot: RegistrySnapshot,
    currentVersion: number,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<RegistrySnapshot> {
    if (!env.OBCF_KV || !env.OBCF_D1) return snapshot;
    if (currentVersion <= snapshot.v) return snapshot;

    try {
        const context = await loadUserContext(userId, env);
        const refreshed: RegistrySnapshot = {
            c: snapshot.c,
            v: currentVersion,
            organizationId: context.organizationId,
            roles: context.roles,
            permissions: context.permissions,
            createdAt: context.createdAt ?? snapshot.createdAt,
        };
        // Rewrite so the version matches and subsequent requests skip the D1 read.
        await writeRegistrySnapshot(userId, jti, refreshed, resolveSessionMaxAge(env, options), env).catch(() => {});
        return refreshed;
    } catch (error) {
        console.warn('Failed to refresh session snapshot from D1:', error);
        return snapshot;
    }
}

function buildUser(payload: SessionTokenPayload, snapshot: RegistrySnapshot | null, freshUser?: Partial<SessionUser>): SessionUser {
    return {
        id: payload.sub,
        email: payload.email,
        name: freshUser?.name ?? payload.name ?? null,
        image: freshUser?.image ?? payload.image ?? null,
        emailVerified: freshUser?.emailVerified ?? payload.emailVerified ?? null,
        organizationId: snapshot?.organizationId ?? payload.organizationId ?? null,
        roles: snapshot?.roles ?? [],
        permissions: snapshot?.permissions ?? [],
        createdAt: snapshot?.createdAt ?? payload.createdAt ?? null,
    };
}

/**
 * Resolve the current session from a request's cookies.
 *
 * Hot path: JWT signature + expiry check, then a single parallel batch of KV reads
 * (bulk-revocation marker, per-session tombstone, registry snapshot). No database
 * read unless a profile-version bump flags the snapshot stale, or a freshly-issued
 * session's registry record has not yet propagated (self-healed within the grace window).
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

    // Revocation is enforced via KV and MUST fail closed: without KV we cannot know
    // whether a captured JWT was signed out, so we refuse to trust it.
    if (!env.OBCF_KV) {
        console.error('[auth] OBCF_KV is not bound; refusing to trust session tokens without revocation checks.');
        return null;
    }

    const iatMs = (Number(payload.iat) || 0) * 1000;

    // One parallel batch for the whole hot path: bulk-revocation marker, per-session
    // sign-out tombstone, registry snapshot, and the profile-version counter. All keys
    // are known upfront from the verified payload, so this is a single KV round trip.
    let revokedSinceRaw: string | null;
    let tombstoneRaw: string | null;
    let registryRaw: string | null;
    let profileVersionRaw: string | null;
    try {
        [revokedSinceRaw, tombstoneRaw, registryRaw, profileVersionRaw] = await Promise.all([
            env.OBCF_KV.get(revokedSinceKey(payload.sub)),
            env.OBCF_KV.get(revokedJtiKey(payload.sub, payload.jti)),
            env.OBCF_KV.get(sessionRegistryKey(payload.sub, payload.jti)),
            env.OBCF_KV.get(profileVersionKey(payload.sub)),
        ]);
    } catch (error) {
        // A transient KV read error must not silently trust the token.
        console.warn('Failed to read session revocation state; failing closed:', error);
        return null;
    }

    // Single sign-out tombstone -- always wins, even inside the grace window.
    if (tombstoneRaw) return null;

    const currentVersion = Number(profileVersionRaw || 0) || 0;
    let snapshot = parseSnapshot(registryRaw);

    // Bulk revocation ("revoked since <ms>"): reject any session created before it.
    if (revokedSinceRaw) {
        const revokedAtMs = Number(revokedSinceRaw);
        const createdMs = snapshot?.c || iatMs;
        if (Number.isFinite(revokedAtMs) && createdMs > 0 && createdMs < revokedAtMs) return null;
    }

    if (snapshot) {
        snapshot = await refreshSnapshotIfStale(payload.sub, payload.jti, snapshot, currentVersion, env, options);
    } else {
        // No registry record. Either (a) freshly issued and not yet propagated across
        // colos / registry write is catching up, or (b) signed out / expired.
        const ageSeconds = iatMs > 0 ? (Date.now() - iatMs) / 1000 : Number.POSITIVE_INFINITY;
        if (ageSeconds > REGISTRY_GRACE_SECONDS) return null;

        // Within grace: self-heal by loading the context from D1 and re-writing the
        // registry record so later requests hit the fast path.
        if (env.OBCF_D1) {
            const context = await loadUserContext(payload.sub, env);
            snapshot = {
                c: iatMs || Date.now(),
                v: currentVersion,
                organizationId: context.organizationId,
                roles: context.roles,
                permissions: context.permissions,
                createdAt: context.createdAt,
            };
            await writeRegistrySnapshot(payload.sub, payload.jti, snapshot, resolveSessionMaxAge(env, options), env).catch(
                () => {},
            );
        }
    }

    void options;

    return { user: buildUser(payload, snapshot), expires: (payload.exp ?? 0) * 1000 };
}

/** Revoke a single session (used by normal sign-out). Fails loudly so callers can surface it. */
export async function revokeSession(userId: string, jti: string, env: AuthEnv, options?: CreateAuthConfigOptions): Promise<void> {
    if (!env.OBCF_KV) return;
    const maxAgeSeconds = resolveSessionMaxAge(env, options);
    // Write a deny-list tombstone (honored even within the registry grace window) and
    // drop the allow-list snapshot. The tombstone TTL covers the max session lifetime.
    await env.OBCF_KV.put(revokedJtiKey(userId, jti), '1', { expirationTtl: maxAgeSeconds });
    await env.OBCF_KV.delete(sessionRegistryKey(userId, jti)).catch((error) => {
        console.warn('Failed to delete session registry record on sign-out:', error);
    });
}

/** Revoke every session for a user (used by password change/reset). Fails loudly. */
export async function revokeAllUserSessions(userId: string, env: AuthEnv, options?: CreateAuthConfigOptions): Promise<void> {
    if (!env.OBCF_KV) return;
    const maxAgeSeconds = resolveSessionMaxAge(env, options);
    // Millisecond granularity so a session reissued in the same second as the revoke
    // (e.g. change-password-then-stay-signed-in) is not wrongly invalidated.
    await env.OBCF_KV.put(revokedSinceKey(userId), String(Date.now()), { expirationTtl: maxAgeSeconds });
}
