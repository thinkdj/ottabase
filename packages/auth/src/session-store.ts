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
import { hmacSign } from './crypto';
import { describeRequestDevice, type SessionDevice } from './device';
import { registerConnection } from '@ottabase/ottaorm';
import { OrganizationMember, PLATFORM_ADMIN_PERMISSION, User } from '@ottabase/ottaorm/models';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { SYSTEM_ORGANIZATION_ID, parseBooleanFlag } from './bootstrap';
import { clearCookie, isHttpsRequest, parseCookies, serializeCookie } from './cookies';
import { signJwt, verifyJwt } from './jwt';
import type { AuthEnv, CreateAuthConfigOptions, Session, SessionTokenPayload, SessionUser } from './types';

export const SESSION_COOKIE_BASE = 'ottabase.session-token';
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
            throw new Error(
                'AUTH_SECRET is too short; use at least 16 characters (32+ recommended, e.g. `openssl rand -base64 32`)',
            );
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

    console.warn(
        '[auth] AUTH_SECRET is not configured. Using an insecure development default -- never deploy this way.',
    );
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
    /** True when a SYSTEM-scoped grant carries platform:admin/'*:*' — the platform-admin flag. */
    platformAdmin: boolean;
    createdAt: number | null;
    name: string | null;
    image: string | null;
    emailVerified: number | null;
    /** The person's formatting preferences, so emails, digests and cron can format without a D1 read. */
    timezone: string | null;
    locale: string | null;
}

/**
 * The mutable snapshot stored in the KV registry record (kept out of the cookie).
 *
 * Anything that can change WITHOUT re-issuing the cookie belongs here, not on the JWT: the
 * cookie is immutable for the session's lifetime, but the snapshot is re-read from D1 whenever
 * the `profile:version` counter is bumped (see refreshSnapshotIfStale). That is why the mutable
 * display fields (name/image/emailVerified) live here too -- a profile edit bumps the version,
 * so getSession returns the fresh values on the next request instead of the stale JWT copy.
 */
interface RegistrySnapshot {
    /** createdMs -- session creation time in epoch ms (used for bulk-revocation comparison). */
    c: number;
    /** profile version this snapshot reflects. */
    v: number;
    organizationId: string | null;
    roles: string[];
    permissions: string[];
    /** Platform-admin flag (system-scoped grant). Persisted so buildUser can serve it. */
    platformAdmin: boolean;
    createdAt: number | null;
    name: string | null;
    image: string | null;
    emailVerified: number | null;
    timezone: string | null;
    locale: string | null;
}

async function loadUserContext(userId: string, env: AuthEnv): Promise<UserContext> {
    ensureOrmConnection(env);

    // Load the user once up front; reused below for roles/createdAt and for the persisted
    // active organization.
    const user = await User.find(userId).catch((error) => {
        console.warn('Failed to load user for session context:', error);
        return null;
    });

    // The org switcher persists the user's choice via PATCH /api/users/me. Honor it here, but
    // only if they are still an active member of it -- a stale pointer (e.g. to an org they were
    // removed from) must never grant access. Otherwise fall back to the earliest-joined org.
    const preferredOrgId = user ? String(user.get('activeOrganizationId') || '') || null : null;

    let organizationId: string | null = null;
    try {
        const memberships = await OrganizationMember.where(
            { userId, status: 'active' },
            { orderBy: 'joinedAt', orderDirection: 'asc' },
        );
        const activeOrgIds = memberships.map((m) => String(m.get('organizationId') || '')).filter(Boolean);
        if (preferredOrgId && activeOrgIds.includes(preferredOrgId)) {
            organizationId = preferredOrgId;
        } else if (activeOrgIds[0]) {
            organizationId = activeOrgIds[0];
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
    let platformAdmin = false;
    let createdAt: number | null = null;
    let name: string | null = null;
    let image: string | null = null;
    let emailVerified: number | null = null;
    let timezone: string | null = null;
    let locale: string | null = null;

    try {
        if (user) {
            name = (user.get('name') as string | null) ?? null;
            // The uploaded avatar's public URL, else the OAuth provider's picture.
            image = user.imageUrl();
            timezone = (user.get('timezone') as string | null) || null;
            locale = (user.get('locale') as string | null) || null;
            const emailVerifiedRaw = user.get('emailVerified');
            emailVerified =
                emailVerifiedRaw == null
                    ? null
                    : Number.isFinite(Number(emailVerifiedRaw))
                      ? Number(emailVerifiedRaw)
                      : null;

            const roleNameSet = new Set<string>();
            const permissionSet = new Set<string>();
            // Permissions from SYSTEM-scoped grants only — the platform-admin flag derives from
            // these, so an org-scoped grant (or a role merely NAMED 'owner'/'admin') can never
            // confer platform authority.
            const systemPermissionSet = new Set<string>();
            const collectRoles = (records: any[], isSystemScope: boolean) => {
                for (const role of records) {
                    roleNameSet.add(String(role.get('name')));
                    const rolePerms = (role as { getPermissions?: () => string[] }).getPermissions?.() ?? [];
                    for (const perm of rolePerms) {
                        permissionSet.add(perm);
                        if (isSystemScope) systemPermissionSet.add(perm);
                    }
                }
            };

            if (organizationId) {
                const orgRoleRecords = await user.roles({ organizationId });
                collectRoles(orgRoleRecords, organizationId === SYSTEM_ORGANIZATION_ID);
            }

            // Also load system-scope roles (e.g. platform_owner) so that users
            // who hold a system-level grant see the correct permissions in their
            // session — mirrors what getRequestContext does on the backend.
            if (organizationId !== SYSTEM_ORGANIZATION_ID) {
                const systemRoleRecords = await user.roles({ organizationId: SYSTEM_ORGANIZATION_ID });
                collectRoles(systemRoleRecords, true);
            }

            roles = [...roleNameSet];
            permissions = [...permissionSet];
            platformAdmin = hasGrantedPermission(systemPermissionSet, PLATFORM_ADMIN_PERMISSION);
            const createdAtRaw = user.get('createdAt');
            if (createdAtRaw) {
                const parsed =
                    createdAtRaw instanceof Date ? createdAtRaw.getTime() : new Date(String(createdAtRaw)).getTime();
                createdAt = Number.isFinite(parsed) ? parsed : null;
            }
        }
    } catch (error) {
        console.warn('Failed to load user roles/permissions for session:', error);
    }

    return {
        organizationId,
        roles,
        permissions,
        platformAdmin,
        createdAt,
        name,
        image,
        emailVerified,
        timezone,
        locale,
    };
}

/**
 * Identity + display fields for a new session. Authorization data (organization, roles,
 * permissions, platform-admin) is deliberately NOT accepted here: it is always loaded from D1
 * by `loadUserContext`, so no caller can mint a session with a self-declared grant.
 */
export interface CreateSessionInput {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: number | null;
    /** Device facts shown on the sessions page; `createSessionCookieForUser` fills them from the request. */
    device?: SessionDevice | null;
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

/**
 * KV key metadata on the registry record (under 1 KB, returned by `list()` without a get). This
 * is what the sessions page shows: created/expires, device, masked IP, location and a name.
 * Rewrites of the record must carry it along, or `list()` loses the device facts.
 */
export interface SessionMetadata {
    /** createdMs */
    c: number;
    /** expiresMs */
    e: number;
    /** "Chrome on Windows" */
    ua?: string;
    /** masked IP */
    ip?: string;
    /** "City, CC" */
    geo?: string;
    /** user-chosen name */
    n?: string;
}

async function writeRegistrySnapshot(
    userId: string,
    jti: string,
    snapshot: RegistrySnapshot,
    maxAgeSeconds: number,
    env: AuthEnv,
    metadata?: SessionMetadata | null,
): Promise<void> {
    if (!env.OBCF_KV) return;
    await env.OBCF_KV.put(sessionRegistryKey(userId, jti), JSON.stringify(snapshot), {
        expirationTtl: maxAgeSeconds,
        ...(metadata ? { metadata } : {}),
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
    // Fail closed, end-to-end: getSession refuses to trust any token without KV (revocation
    // cannot be checked), so minting a cookie when KV is unbound would strand the user in a
    // login loop (create "succeeds", every subsequent request is unauthenticated). Refuse here
    // instead — the failure is explicit at sign-in rather than a silent logout.
    if (!env.OBCF_KV) {
        throw new Error('Session store (OBCF_KV) is not bound; cannot create a session');
    }

    const context = await loadUserContext(input.id, env);

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
        cms: createdMs,
    };

    const token = await signJwt(payload, secret, { expiresInSeconds: maxAgeSeconds });
    const expiresAt = createdMs + maxAgeSeconds * 1000;

    const snapshot: RegistrySnapshot = {
        c: createdMs,
        v: profileVersion,
        organizationId: context.organizationId,
        roles: context.roles,
        permissions: context.permissions,
        platformAdmin: context.platformAdmin,
        createdAt: context.createdAt,
        name: input.name ?? null,
        image: input.image ?? null,
        emailVerified: input.emailVerified ?? null,
        timezone: context.timezone,
        locale: context.locale,
    };

    const metadata: SessionMetadata = {
        c: createdMs,
        e: expiresAt,
        ...(input.device?.userAgent ? { ua: input.device.userAgent.slice(0, 80) } : {}),
        ...(input.device?.ip ? { ip: input.device.ip.slice(0, 48) } : {}),
        ...(input.device?.geo ? { geo: input.device.geo.slice(0, 80) } : {}),
    };

    // KV is guaranteed bound by the guard at the top of this function.
    try {
        await writeRegistrySnapshot(input.id, jti, snapshot, maxAgeSeconds, env, metadata);
    } catch (error) {
        // Retry once, then fail the sign-in: fail-closed must be end-to-end.
        try {
            await writeRegistrySnapshot(input.id, jti, snapshot, maxAgeSeconds, env, metadata);
        } catch (retryError) {
            console.error('Failed to persist session registry record:', retryError);
            throw new Error('Failed to persist session; sign-in aborted');
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
            platformAdmin: context.platformAdmin,
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
 * (e.g. the first-run platform-owner bootstrap wizard).
 */
export async function createSessionCookieForUser(
    input: CreateSessionInput,
    env: AuthEnv,
    request: Request,
    options?: CreateAuthConfigOptions,
): Promise<{ cookie: string; session: CreatedSession }> {
    const maxAgeSeconds = resolveSessionMaxAge(env, options);
    const session = await createSessionForUser(
        { ...input, device: input.device ?? describeRequestDevice(request) },
        env,
        options,
    );
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
            platformAdmin: parsed.platformAdmin === true,
            createdAt: parsed.createdAt ?? null,
            name: parsed.name ?? null,
            image: parsed.image ?? null,
            emailVerified: parsed.emailVerified ?? null,
            timezone: typeof parsed.timezone === 'string' ? parsed.timezone : null,
            locale: typeof parsed.locale === 'string' ? parsed.locale : null,
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
    metadata?: SessionMetadata | null,
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
            platformAdmin: context.platformAdmin,
            createdAt: context.createdAt ?? snapshot.createdAt,
            name: context.name,
            image: context.image,
            emailVerified: context.emailVerified,
            timezone: context.timezone,
            locale: context.locale,
        };
        // Rewrite so the version matches and subsequent requests skip the D1 read. The device
        // metadata rides along, or the sessions page would lose it on the first profile edit.
        await writeRegistrySnapshot(userId, jti, refreshed, resolveSessionMaxAge(env, options), env, metadata).catch(
            () => {},
        );
        return refreshed;
    } catch (error) {
        console.warn('Failed to refresh session snapshot from D1:', error);
        return snapshot;
    }
}

function buildUser(payload: SessionTokenPayload, snapshot: RegistrySnapshot | null): SessionUser {
    // Mutable display fields prefer the snapshot (re-read from D1 on a profile-version bump) over
    // the immutable JWT copy, so a profile edit is reflected on the next getSession without having
    // to re-issue the cookie. Roles/permissions/org already work this way.
    return {
        id: payload.sub,
        email: payload.email,
        name: snapshot?.name ?? payload.name ?? null,
        image: snapshot?.image ?? payload.image ?? null,
        emailVerified: snapshot?.emailVerified ?? payload.emailVerified ?? null,
        organizationId: snapshot?.organizationId ?? payload.organizationId ?? null,
        roles: snapshot?.roles ?? [],
        permissions: snapshot?.permissions ?? [],
        platformAdmin: snapshot?.platformAdmin ?? false,
        createdAt: snapshot?.createdAt ?? payload.createdAt ?? null,
        timezone: snapshot?.timezone ?? null,
        locale: snapshot?.locale ?? null,
    };
}

/**
 * Resolve the current session from a request's cookies.
 *
 * Hot path: JWT signature + expiry check, then a single parallel batch of 4 KV reads
 * (bulk-revocation marker, per-session sign-out tombstone, registry snapshot, and the
 * profile-version counter). No database read unless a profile-version bump flags the
 * snapshot stale, or a freshly-issued session's registry record has not yet propagated
 * (self-healed from D1 within the grace window).
 */
export async function getSession(
    request: Request,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<Session | null> {
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

    // `cms` is the ms-granular creation time every issued token carries; `iat` is second-
    // granular and too coarse for the revoke-all comparison (a floored second would wrongly
    // reject a session reissued in the same second as a revoke-all -- see revokeAllUserSessions).
    const iatMs = (Number(payload.iat) || 0) * 1000;
    const createdMsClaim = Number(payload.cms) || 0;

    // One parallel batch for the whole hot path: bulk-revocation marker, per-session
    // sign-out tombstone, registry snapshot, and the profile-version counter. All keys
    // are known upfront from the verified payload, so this is a single KV round trip.
    let revokedSinceRaw: string | null;
    let tombstoneRaw: string | null;
    let registryRaw: string | null;
    let registryMetadata: SessionMetadata | null;
    let profileVersionRaw: string | null;
    try {
        const [revokedSince, tombstone, registry, profileVersion] = await Promise.all([
            env.OBCF_KV.get(revokedSinceKey(payload.sub)),
            env.OBCF_KV.get(revokedJtiKey(payload.sub, payload.jti)),
            env.OBCF_KV.getWithMetadata<SessionMetadata>(sessionRegistryKey(payload.sub, payload.jti)),
            env.OBCF_KV.get(profileVersionKey(payload.sub)),
        ]);
        revokedSinceRaw = revokedSince;
        tombstoneRaw = tombstone;
        registryRaw = registry.value;
        registryMetadata = registry.metadata ?? null;
        profileVersionRaw = profileVersion;
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
        const createdMs = snapshot?.c || createdMsClaim;
        if (Number.isFinite(revokedAtMs) && createdMs > 0 && createdMs < revokedAtMs) return null;
    }

    if (snapshot) {
        snapshot = await refreshSnapshotIfStale(
            payload.sub,
            payload.jti,
            snapshot,
            currentVersion,
            env,
            options,
            registryMetadata,
        );
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
                c: createdMsClaim || Date.now(),
                v: currentVersion,
                organizationId: context.organizationId,
                roles: context.roles,
                permissions: context.permissions,
                platformAdmin: context.platformAdmin,
                createdAt: context.createdAt,
                name: context.name,
                image: context.image,
                emailVerified: context.emailVerified,
                timezone: context.timezone,
                locale: context.locale,
            };
            await writeRegistrySnapshot(payload.sub, payload.jti, snapshot, resolveSessionMaxAge(env, options), env, {
                c: snapshot.c,
                e: Number(payload.exp) * 1000,
            }).catch(() => {});
        }
    }

    return { user: buildUser(payload, snapshot), expires: (payload.exp ?? 0) * 1000 };
}

/** Revoke a single session (used by normal sign-out). Fails loudly so callers can surface it. */
export async function revokeSession(
    userId: string,
    jti: string,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<void> {
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
export async function revokeAllUserSessions(
    userId: string,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<void> {
    if (!env.OBCF_KV) return;
    const maxAgeSeconds = resolveSessionMaxAge(env, options);
    // Millisecond granularity so a session reissued in the same second as the revoke
    // (e.g. change-password-then-stay-signed-in) is not wrongly invalidated.
    await env.OBCF_KV.put(revokedSinceKey(userId), String(Date.now()), { expirationTtl: maxAgeSeconds });
}

// ============================================================
// Listing and managing a user's own sessions (the sessions page)
// ============================================================

/** One of a user's sessions, as the sessions page sees it. Never carries the raw `jti`. */
export interface SessionSummary {
    /** Opaque id: an HMAC of the jti under AUTH_SECRET. Only the owner's listing can map it back. */
    id: string;
    name: string | null;
    createdAt: number;
    expiresAt: number;
    device: string | null;
    ip: string | null;
    geo: string | null;
    current: boolean;
}

/** The maximum sessions a listing walks; KV `list` pages are 1000 keys, so one page is plenty. */
const SESSION_LIST_LIMIT = 200;
const SESSION_NAME_MAX = 40;

/** Opaque, stable public id for a session: HMAC-SHA256 of the jti, truncated. */
export async function sessionPublicId(jti: string, env: AuthEnv): Promise<string> {
    return (await hmacSign(`sess:${jti}`, resolveAuthSecret(env))).slice(0, 22);
}

/** `{ userId, jti }` of the caller's cookie after signature + expiry checks, or null. No KV read. */
export async function readSessionIdentity(
    request: Request,
    env: AuthEnv,
): Promise<{ userId: string; jti: string } | null> {
    const token = parseCookies(request.headers.get('Cookie'))[resolveSessionCookieName(env)];
    if (!token) return null;
    try {
        const payload = await verifyJwt<SessionTokenPayload>(token, resolveAuthSecret(env));
        return payload?.sub && payload.jti ? { userId: payload.sub, jti: payload.jti } : null;
    } catch {
        return null;
    }
}

interface ListedSession {
    key: string;
    jti: string;
    metadata: SessionMetadata | null;
    expiration?: number;
}

/**
 * The user's live registry records. Records created before a bulk "revoked since" marker
 * (password change or reset) are already dead for getSession but stay in KV until their TTL,
 * so they are left out here too.
 */
async function listRegistryKeys(userId: string, env: AuthEnv): Promise<ListedSession[]> {
    if (!env.OBCF_KV) return [];
    const prefix = `${userKey('auth', userId, 'sess')}:`;
    const [result, revokedSinceRaw] = await Promise.all([
        env.OBCF_KV.list<SessionMetadata>({ prefix, limit: SESSION_LIST_LIMIT }),
        env.OBCF_KV.get(revokedSinceKey(userId)),
    ]);
    const revokedAt = Number(revokedSinceRaw) || 0;
    return result.keys
        .map((key) => ({
            key: key.name,
            jti: key.name.slice(prefix.length),
            metadata: (key.metadata as SessionMetadata | undefined) ?? null,
            expiration: key.expiration,
        }))
        .filter((entry) => !revokedAt || (entry.metadata?.c ?? 0) >= revokedAt);
}

/**
 * Every live session of `userId`, newest first. `currentJti` marks the caller's own session.
 * KV `list` is eventually consistent (up to about a minute), so a session opened seconds ago may
 * be missing briefly. Expired records vanish through their TTL, so there is no "expired" state.
 */
export async function listUserSessions(
    userId: string,
    env: AuthEnv,
    currentJti?: string | null,
): Promise<SessionSummary[]> {
    const keys = await listRegistryKeys(userId, env);
    const summaries = await Promise.all(
        keys.map(async (entry): Promise<SessionSummary> => {
            const meta = entry.metadata;
            return {
                id: await sessionPublicId(entry.jti, env),
                name: meta?.n ?? null,
                createdAt: meta?.c ?? 0,
                expiresAt: meta?.e ?? (entry.expiration ? entry.expiration * 1000 : 0),
                device: meta?.ua ?? null,
                ip: meta?.ip ?? null,
                geo: meta?.geo ?? null,
                current: Boolean(currentJti) && entry.jti === currentJti,
            };
        }),
    );
    return summaries.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Map a public id back to the owner's jti. Only `userId`'s own keys are searched, so a caller
 * can never address another user's session, whatever id they send.
 */
export async function findUserSessionJti(
    userId: string,
    publicId: string,
    env: AuthEnv,
): Promise<ListedSession | null> {
    for (const entry of await listRegistryKeys(userId, env)) {
        if ((await sessionPublicId(entry.jti, env)) === publicId) return entry;
    }
    return null;
}

/** Rename one of the user's sessions (1 to 40 characters). Re-puts the record with new metadata, same TTL. */
export async function renameUserSession(
    userId: string,
    publicId: string,
    name: string,
    env: AuthEnv,
): Promise<SessionSummary | null> {
    if (!env.OBCF_KV) return null;
    const trimmed = name.trim().slice(0, SESSION_NAME_MAX);
    if (!trimmed) throw new RangeError('Session name is required');
    const entry = await findUserSessionJti(userId, publicId, env);
    if (!entry) return null;
    const value = await env.OBCF_KV.get(entry.key);
    if (value === null) return null;
    const ttl = entry.expiration ? Math.max(60, entry.expiration - Math.floor(Date.now() / 1000)) : undefined;
    const metadata: SessionMetadata = { ...(entry.metadata ?? { c: 0, e: 0 }), n: trimmed };
    await env.OBCF_KV.put(entry.key, value, { ...(ttl ? { expirationTtl: ttl } : {}), metadata });
    return {
        id: publicId,
        name: trimmed,
        createdAt: metadata.c,
        expiresAt: metadata.e,
        device: metadata.ua ?? null,
        ip: metadata.ip ?? null,
        geo: metadata.geo ?? null,
        current: false,
    };
}

/** Revoke one of the user's sessions by public id. False when no such session is theirs. */
export async function revokeUserSessionById(
    userId: string,
    publicId: string,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<boolean> {
    const entry = await findUserSessionJti(userId, publicId, env);
    if (!entry) return false;
    await revokeSession(userId, entry.jti, env, options);
    return true;
}

/**
 * Sign out every listed session except `currentJti`. Unlike `revokeAllUserSessions`, whose
 * "revoked since" marker would also kill the current one, this tombstones each other jti.
 */
export async function revokeOtherUserSessions(
    userId: string,
    currentJti: string,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<number> {
    const others = (await listRegistryKeys(userId, env)).filter((entry) => entry.jti !== currentJti);
    await Promise.all(others.map((entry) => revokeSession(userId, entry.jti, env, options)));
    return others.length;
}

/**
 * Was the caller's session ended on purpose (revoked from another device, or by a password
 * change) rather than simply missing or expired? Lets a 401 tell the person what happened.
 * Two KV reads; call it only on a request that already failed authentication.
 */
export async function wasSessionRevoked(request: Request, env: AuthEnv): Promise<boolean> {
    if (!env.OBCF_KV) return false;
    const token = parseCookies(request.headers.get('Cookie'))[resolveSessionCookieName(env)];
    if (!token) return false;
    let payload: SessionTokenPayload | null;
    try {
        payload = await verifyJwt<SessionTokenPayload>(token, resolveAuthSecret(env));
    } catch {
        return false;
    }
    if (!payload?.sub || !payload.jti) return false;
    try {
        const [tombstone, revokedSince] = await Promise.all([
            env.OBCF_KV.get(revokedJtiKey(payload.sub, payload.jti)),
            env.OBCF_KV.get(revokedSinceKey(payload.sub)),
        ]);
        if (tombstone) return true;
        const revokedAt = Number(revokedSince) || 0;
        const createdMs = Number(payload.cms) || 0;
        return revokedAt > 0 && createdMs > 0 && createdMs < revokedAt;
    } catch {
        return false;
    }
}

/**
 * Sign the user out everywhere AND delete every session record, with its device, masked IP and
 * location. For an erasure: a "revoked since" marker alone would leave those records in KV until
 * their TTL. Returns how many records were deleted.
 */
export async function purgeUserSessions(
    userId: string,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<number> {
    if (!env.OBCF_KV) return 0;
    await revokeAllUserSessions(userId, env, options);
    const prefix = `${userKey('auth', userId, 'sess')}:`;
    let deleted = 0;
    let cursor: string | undefined;
    do {
        const page = await env.OBCF_KV.list({ prefix, cursor, limit: 1000 });
        await Promise.all(page.keys.map((key) => env.OBCF_KV!.delete(key.name)));
        deleted += page.keys.length;
        cursor = page.list_complete ? undefined : (page as { cursor?: string }).cursor;
    } while (cursor);
    return deleted;
}
