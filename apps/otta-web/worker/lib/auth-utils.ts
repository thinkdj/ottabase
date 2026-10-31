import { type AuthEvents, CreateAuthConfigOptions, hashToken } from '@ottabase/auth/backend';
import { userKey } from '@ottabase/cf';
import { PLATFORM_ORG_SENTINEL } from '@ottabase/config';
import { invalidateCache, invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, SecurityContext } from '@ottabase/ottaorm';
import { Account, OrganizationMember, UserGroup, UserGroupMember, VerificationToken } from '@ottabase/ottaorm/models';
import { sendTemplatedEmail } from '@ottabase/email';
import { redactErrorForLog, ServiceError } from '@ottabase/utils/http-errors';
import { sanitizeInlineHtml, sanitizeUrl } from '@ottabase/utils/sanitize';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { events } from '../../ottabase/events';
import { SUPPORTED_LANGUAGES } from '../../ottabase/locale';
import { registerAppEmailTemplates } from '../../src/email/templates';
import { resolveAppMailer } from './email-provider';
import { ensurePersonalOrganization } from './user-provisioning';
import { createSecureToken, isDemoMode } from './utils';

export async function resolveMailer(env: CloudflareEnv) {
    return resolveAppMailer(env, 'auto');
}

/**
 * Public demo only: a short welcome to a new account, pointing at what signing in unlocked and at
 * the deploy's call to action (`DEMO_CTA_LABEL` / `DEMO_CTA_URL`). Best-effort: a mail failure
 * never fails the sign-up that triggered it.
 */
export async function sendDemoWelcomeEmail(env: CloudflareEnv, to: string): Promise<void> {
    if (!isDemoMode(env)) return;
    try {
        const { mailer, from } = await resolveMailer(env);
        if (!mailer) return;
        const appName = sanitizeInlineHtml(getOttabaseConfig(env).appName || 'the demo');
        const origin = env.AUTH_URL?.replace(/\/+$/, '');
        const demoLink = origin ? `<p><a href="${sanitizeUrl(`${origin}/demo`)}">Open the demo</a></p>` : '';
        const cta =
            env.DEMO_CTA_URL && env.DEMO_CTA_LABEL
                ? `<p><a href="${sanitizeUrl(env.DEMO_CTA_URL)}">${sanitizeInlineHtml(env.DEMO_CTA_LABEL)}</a></p>`
                : '';

        registerAppEmailTemplates();
        await sendTemplatedEmail(mailer, {
            from,
            to,
            template: 'minimalist',
            subject: `Welcome to ${appName}`,
            variables: {
                subject: `Welcome to ${appName}`,
                header: 'Your demo account is ready',
                body: `<p>You have a workspace of your own, and the demos that need an account are open to you now: realtime pub/sub, screenshots, AI, PDF rendering and uploads.</p>
${demoLink}${cta}`,
                footer: `<p>This is a public demo. Treat what you store here as temporary.</p>`,
            },
        });
    } catch (error) {
        console.warn(JSON.stringify({ event: 'demo_welcome_email_failed', error: redactErrorForLog(error) }));
    }
}

export async function createVerificationToken(
    env: CloudflareEnv,
    identifier: string,
    ttlSeconds: number,
): Promise<{ token: string; expiresAt: number }> {
    if (!env.OBCF_D1) {
        throw new Error('D1 database binding not configured');
    }

    const token = createSecureToken(32);
    // Store only the hash: the plaintext token lives solely in the emailed link, so a
    // database read leak cannot be replayed to verify an email or reset a password.
    const tokenHash = await hashToken(token);
    const expiresAt = Date.now() + ttlSeconds * 1000;

    try {
        await env.OBCF_D1.prepare(`DELETE FROM verification_tokens WHERE identifier = ?`).bind(identifier).run();
    } catch {
        // ignore cleanup errors
    }

    await VerificationToken.create({
        identifier,
        token: tokenHash,
        expires: expiresAt,
    });

    return { token, expiresAt };
}

export function getAuthOptions(env: CloudflareEnv): CreateAuthConfigOptions {
    const options: CreateAuthConfigOptions = {
        errorPage: '/login',
        supportedLanguages: SUPPORTED_LANGUAGES,
    };

    const maxAge = Number(env.AUTH_SESSION_MAX_AGE);
    if (Number.isFinite(maxAge) && maxAge > 0) {
        options.sessionMaxAge = maxAge;
    }

    const requireVerified = env.AUTH_REQUIRE_EMAIL_VERIFIED === 'true' || env.AUTH_REQUIRE_EMAIL_VERIFIED === '1';
    if (requireVerified) {
        options.requireVerifiedEmail = true;
    }

    const disableCredentials = env.AUTH_DISABLE_CREDENTIALS === 'true' || env.AUTH_DISABLE_CREDENTIALS === '1';
    if (disableCredentials) {
        options.disableCredentials = true;
    }

    // Clear RBAC cache when user signs out so stale permissions aren't served
    options.onSignOut = async (_userId: string) => {
        if (!env.OBCF_KV) return;
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    };

    // On sign-in, activate any pending email invites (org + group) for this user so an invitee who
    // signs up is immediately a member. No-op until email invites exist.
    options.onSignIn = async ({ userId, email }) => {
        if (!env.OBCF_D1 || !email) return;
        try {
            registerConnection('default', createD1Driver(env.OBCF_D1));
            await Promise.all([
                OrganizationMember.activatePendingInvites(userId, email),
                UserGroupMember.activatePendingInvites(userId, email),
            ]);
            // Invites may have just granted memberships — drop this user's cached
            // security-context lookups so the new org/groups are visible immediately
            // instead of after MEMBERSHIP_CACHE_TTL_SECONDS.
            await invalidateMembershipCache(env.OBCF_KV, userId);
        } catch (error) {
            console.warn(
                JSON.stringify({
                    event: 'pending_invite_activation_failed',
                    error: redactErrorForLog(error),
                }),
            );
        }

        // Every account gets a workspace, whichever way it signed in (credentials sign-up already
        // provisions one). Not caught: @ottabase/auth turns a throw here into a refused sign-in,
        // because an account without its organization is not a successful sign-in.
        const organizationId = await ensurePersonalOrganization({
            userId,
            email,
            appId: getOttabaseConfig(env).appId,
        });
        if (organizationId) {
            await invalidateMembershipCache(env.OBCF_KV, userId);
            await sendDemoWelcomeEmail(env, email);
        }

        // Tell the bus, after provisioning. Never refuses the sign-in (see emitAccountEvent).
        await emitAccountEvent(env, 'user.signed-in', { userId, email, organizationId: organizationId ?? null });
    };

    // OAuth and magic-link accounts are created (and verified) inside @ottabase/auth, which tells
    // the bus through this. The env is this request's: the one the bus and its subscribers expect.
    options.emit = (_env, name, payload) => emitAccountEvent<keyof AuthEvents>(env, name, payload);

    return options;
}

/** The account events on the app's bus. `@ottabase/auth` emits the first two through `options.emit`. */
type AccountEvents = AuthEvents & {
    'user.signed-in': { userId: string; email: string; organizationId: string | null };
};

/**
 * Tell the bus about an account: `user.created`, `user.verified`, `user.signed-in`. Packages
 * that keep a timeline or run sequences subscribe without the auth flow knowing them.
 * Best-effort: a listener's failure never fails the sign-up, the verification or the sign-in.
 */
export async function emitAccountEvent<K extends keyof AccountEvents>(
    env: CloudflareEnv,
    name: K,
    payload: AccountEvents[K],
): Promise<void> {
    const organizationId = (payload as { organizationId?: string | null }).organizationId ?? null;
    try {
        await events.emit(env, name, payload, {
            actor: { userId: payload.userId, organizationId, appId: getOttabaseConfig(env).appId },
        });
    } catch (error) {
        console.warn(JSON.stringify({ event: 'account_event_failed', name, error: redactErrorForLog(error) }));
    }
}

/**
 * TTL (seconds) for cached membership lookups powering the security context.
 *
 * 300s matches the RBAC permission cache precedent. The TTL is only the
 * FALLBACK bound (custom code that mutates memberships without calling
 * invalidateMembershipCache): every in-app mutation path invalidates eagerly —
 * sign-in invite activation, admin member invite/update/remove, org creation,
 * and generic CRUD on membership models (see ottaorm-crud.ts). Raising this
 * further buys little (an active user refreshes once per TTL anyway) while
 * widening the blast radius of any missed invalidation.
 */
const MEMBERSHIP_CACHE_TTL_SECONDS = 300;

export class SecurityContextUnavailableError extends ServiceError {
    public readonly membershipScope: 'organization' | 'group';

    constructor(membershipScope: 'organization' | 'group', internalCause?: unknown) {
        super('Security context temporarily unavailable', 503, {
            code: 'SECURITY_CONTEXT_UNAVAILABLE',
            internalCause,
        });
        this.name = 'SecurityContextUnavailableError';
        this.membershipScope = membershipScope;
    }
}

function normalizeMembershipIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error('Membership resolver returned an invalid result');
    }

    return [...new Set(value)];
}

/**
 * Read-through cached membership lookup (KV in front of D1).
 *
 * KV is strictly an optimization: malformed/stale-unreadable cache data falls
 * back to one authoritative D1 lookup, and cache writes are best-effort. Keeping
 * cache and source failures separate avoids accidentally retrying a failed D1
 * query and ensures a cache outage cannot weaken membership resolution.
 */
async function cachedMembershipLookup(
    kv: CloudflareEnv['OBCF_KV'] | undefined,
    key: string,
    fetcher: () => Promise<string[]>,
): Promise<string[]> {
    if (kv) {
        try {
            const cached = await kv.get(key, 'text');
            if (cached !== null) {
                return normalizeMembershipIds(JSON.parse(cached));
            }
        } catch {
            // Cache reads and malformed cached values never replace the authoritative lookup.
        }
    }

    const memberships = normalizeMembershipIds(await fetcher());

    if (kv) {
        try {
            await kv.put(key, JSON.stringify(memberships), {
                expirationTtl: MEMBERSHIP_CACHE_TTL_SECONDS,
            });
        } catch {
            // Membership was resolved authoritatively; a failed cache write must not fail the request.
        }
    }

    return memberships;
}

/**
 * Drop a user's cached membership lookups (member-orgs + all member-groups keys).
 *
 * Call after ANY membership mutation (grant, role/status change, removal) so the
 * change takes effect on the next request instead of after MEMBERSHIP_CACHE_TTL_SECONDS.
 * Best-effort: failures are swallowed — the TTL still bounds staleness, and KV's
 * eventual consistency means cross-colo propagation can take up to ~60s regardless.
 */
export async function invalidateMembershipCache(
    kv: CloudflareEnv['OBCF_KV'] | undefined,
    userId: string | undefined | null,
): Promise<void> {
    if (!kv || !userId) return;
    try {
        await Promise.all([
            invalidateCache(kv, userKey('auth', userId, 'member-orgs')),
            invalidateCacheByPrefix(kv, userKey('auth', userId, 'member-groups')),
        ]);
    } catch {
        // Best-effort — TTL bounds staleness if KV invalidation fails.
    }
}

/**
 * Bump a user's session profile-version counter so their NEXT getSession re-reads the KV session
 * snapshot from D1 (see refreshSnapshotIfStale in @ottabase/auth). Call after ANY server mutation
 * of a session-reflected field (name/image/emailVerified/org/roles/permissions/membership) so live
 * sessions reflect the change instead of serving the stale snapshot until the cookie JWT expires.
 *
 * Best-effort: a KV failure only delays the refresh to the next natural bump. The version key's TTL
 * mirrors the session max-age so it always outlives the sessions it gates.
 */
export async function bumpProfileVersion(env: CloudflareEnv, userId: string | undefined | null): Promise<void> {
    if (!env.OBCF_KV || !userId) return;
    try {
        await env.OBCF_KV.put(userKey('auth', userId, 'profile', 'version'), String(Date.now()), {
            expirationTtl: Number(env.AUTH_SESSION_MAX_AGE) || 30 * 24 * 60 * 60,
        });
    } catch (error) {
        console.warn(
            JSON.stringify({
                event: 'profile_version_bump_failed',
                error: redactErrorForLog(error),
            }),
        );
    }
}

/**
 * After a system-role RECONCILE (the `/__bootstrap__/seed` self-heal): drop RBAC caches and refresh
 * the sessions whose authority could have changed, so a healed permission set — and the derived
 * `platformAdmin` flag — takes effect without waiting out the ~30-day JWT.
 *
 * Bounded on purpose (Cloudflare Workers cap subrequests per invocation): it bumps only the
 * SYSTEM-SCOPED platform_owner holder set, which is tiny (usually one), and which is exactly the
 * security-critical, control-plane session. Org-scoped role holders (e.g. every user's personal
 * `owner`) are far too many to bump in one request AND their stale grants are org-bounded (RLS keeps
 * them to their own tenant), so they are intentionally left to refresh on next sign-in.
 */
export async function reconcileSystemRoleSessions(env: CloudflareEnv): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    } catch {
        // Non-fatal — TTL bounds staleness.
    }
    try {
        const { PLATFORM_OWNER_ROLE_NAME, Role, UserRole } = await import('@ottabase/ottaorm/models');
        const platformOwnerRole = await Role.findByName(PLATFORM_OWNER_ROLE_NAME);
        if (!platformOwnerRole) return;
        const holders = await UserRole.where({ roleId: platformOwnerRole.get('id') as string });
        const userIds = [...new Set(holders.map((h) => String(h.get('userId'))).filter(Boolean))];
        await Promise.allSettled(userIds.map((userId) => bumpProfileVersion(env, userId)));
    } catch (error) {
        console.warn(
            JSON.stringify({
                event: 'platform_owner_session_reconcile_failed',
                error: redactErrorForLog(error),
            }),
        );
    }
}

export async function getSecurityContext(
    request: Request,
    session: any | null,
    env?: CloudflareEnv,
): Promise<SecurityContext> {
    const url = new URL(request.url);

    const userId = session?.user?.id;

    let organizationId: string | null = null;

    // Explicit PLATFORM scope: a platform admin may act on platform-owned rows
    // (organizationId NULL — e.g. the platform's own blog in org mode) by sending
    // x-org-id: platform. This must override every other resolution path,
    // including the session's active org — that is the point of the switch.
    // For anyone else the sentinel is simply ignored (it is never a real org id).
    const orgHeaderRaw = request.headers.get('x-org-id');
    const explicitPlatformScope = session?.user?.platformAdmin === true && orgHeaderRaw === PLATFORM_ORG_SENTINEL;

    if (!explicitPlatformScope) {
        if (session?.user?.organizationId) {
            organizationId = session.user.organizationId;
        }

        if (!organizationId) {
            if (orgHeaderRaw && orgHeaderRaw !== 'null' && orgHeaderRaw !== PLATFORM_ORG_SENTINEL) {
                organizationId = orgHeaderRaw;
            }
        }
    }

    if (!organizationId && !explicitPlatformScope) {
        const host = request.headers.get('host') || url.hostname;
        const subdomain = host.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && !host.startsWith('127.0.0.1')) {
            organizationId = `org-${subdomain}`;
        }
    }

    if (!organizationId && !explicitPlatformScope) {
        const orgQuery = url.searchParams.get('organizationId');
        if (orgQuery && orgQuery !== 'null') {
            organizationId = orgQuery;
        }
    }

    // App scope is trusted server configuration. A browser-controlled x-app-id
    // header must never select an RLS partition.
    const configAppId = env ? getOttabaseConfig(env).appId : undefined;
    const appId = configAppId || 'web';
    const roles = session?.user?.roles as string[] | undefined;
    const permissions = session?.user?.permissions as string[] | undefined;
    // Scope-aware platform-admin flag (derived server-side from a SYSTEM-scoped grant). RLS
    // AdminOnly policies gate on this, NOT on role names — see packages/ottaorm rls/types.ts.
    const platformAdmin = session?.user?.platformAdmin === true;

    // Collect the organization IDs the user can access — ACTIVE MEMBERSHIPS only (organizationIdsForUser
    // no longer trusts the never-cleared Organization.ownerId; see that method for why).
    // Always keep the resolved list — INCLUDING when it is empty. An empty array is a positive
    // "this user belongs to zero organizations", which fails closed below. The RLS engine denies
    // BOTH an empty list and an unresolved (`undefined`) one for any org-scoped operation, so a
    // signed-in context must always carry this list; only anonymous callers (no org) go without.
    let memberOrganizationIds: string[] | undefined;
    if (userId) {
        try {
            memberOrganizationIds = await cachedMembershipLookup(
                env?.OBCF_KV,
                userKey('auth', userId, 'member-orgs'),
                () => OrganizationMember.organizationIdsForUser(userId),
            );
        } catch (error) {
            throw new SecurityContextUnavailableError('organization', error);
        }
    }

    // Defense-in-depth: never honor an active org the user isn't actually a member of.
    // The active org arrives via session/header/subdomain/query and is otherwise unverified,
    // so this is what prevents an X-Org-Id (or stale session) value from granting cross-tenant
    // access. (The ottaorm RLS engine also enforces this when memberOrganizationIds is passed.)
    // `Array.isArray` (not a truthiness check) so a resolved-but-empty list still drops the org:
    // a user with no memberships can never validate any active org.
    if (
        userId &&
        organizationId &&
        Array.isArray(memberOrganizationIds) &&
        !memberOrganizationIds.includes(organizationId)
    ) {
        organizationId = null;
    }

    // An ANONYMOUS caller has no membership to validate against, so a header/subdomain/query org
    // would otherwise reach RLS unverified and scope tenant-filtered reads to whichever org the
    // caller named. Anonymous requests never get an org partition; routes that legitimately serve
    // anonymous org-owned data (comments) derive the org from the target row instead.
    if (!userId) {
        organizationId = null;
    }

    // Group IDs the user can access (active memberships + groups they created). Powers the
    // membership-scoped RLS for user_groups / user_group_members, resolved against the final
    // organizationId so it is scoped to the active org.
    // Cache key includes the VALIDATED organizationId (it may have been nulled by the
    // membership check above) — do not parallelize this with the org lookup.
    let memberGroupIds: string[] | undefined;
    if (userId) {
        try {
            memberGroupIds = await cachedMembershipLookup(
                env?.OBCF_KV,
                userKey('auth', userId, 'member-groups', organizationId ?? 'none'),
                () => UserGroup.groupIdsForUser(userId, organizationId ?? undefined),
            );
        } catch (error) {
            throw new SecurityContextUnavailableError('group', error);
        }
    }

    return {
        userId,
        organizationId,
        appId,
        roles,
        permissions,
        platformAdmin,
        memberOrganizationIds,
        memberGroupIds,
    };
}

export async function getUserLinkedAccounts(
    userId: string,
): Promise<Array<{ provider: string; type: string; createdAt: number | null }>> {
    const accounts = await Account.forUser(userId);
    return accounts.map((account) => {
        const json = account.toJson();
        return {
            provider: json.provider ?? 'unknown',
            type: json.type ?? 'oauth',
            createdAt: json.createdAt ? new Date(json.createdAt).getTime() : null,
        };
    });
}
