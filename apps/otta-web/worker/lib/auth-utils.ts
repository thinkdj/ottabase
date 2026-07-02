import { CreateAuthConfigOptions, hashToken } from '@ottabase/auth/backend';
import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, SecurityContext } from '@ottabase/ottaorm';
import { Account, OrganizationMember, UserGroup, UserGroupMember, VerificationToken } from '@ottabase/ottaorm/models';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import type { CloudflareEnv } from '../cloudflare-env';
import { resolveAppMailer } from './email-provider';
import { createSecureToken } from './utils';

export async function resolveMailer(env: CloudflareEnv) {
    return resolveAppMailer(env, 'auto');
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
        authConfig: {
            pages: {
                signIn: '/login',
                error: '/login',
            },
        },
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

    const verbose = env.AUTH_VERBOSE === 'true' || env.AUTH_VERBOSE === '1';
    if (verbose) {
        options.verbose = true;
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
        } catch (error) {
            console.warn('Failed to activate pending invites on sign-in:', error);
        }
    };

    return options;
}

export async function getSecurityContext(
    request: Request,
    session: any | null,
    env?: CloudflareEnv,
): Promise<SecurityContext> {
    const url = new URL(request.url);

    const userId = session?.user?.id;

    let organizationId: string | null = null;

    if (session?.user?.organizationId) {
        organizationId = session.user.organizationId;
    }

    if (!organizationId) {
        const orgHeader = request.headers.get('x-org-id');
        if (orgHeader && orgHeader !== 'null') {
            organizationId = orgHeader;
        }
    }

    if (!organizationId) {
        const host = request.headers.get('host') || url.hostname;
        const subdomain = host.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && !host.startsWith('127.0.0.1')) {
            organizationId = `org-${subdomain}`;
        }
    }

    if (!organizationId) {
        const orgQuery = url.searchParams.get('organizationId');
        if (orgQuery && orgQuery !== 'null') {
            organizationId = orgQuery;
        }
    }

    // Resolve appId: header > config > fallback
    const configAppId = env ? getOttabaseConfig(env).appId : undefined;
    const appId = request.headers.get('x-app-id') || configAppId || 'web';
    const roles = session?.user?.roles as string[] | undefined;
    const permissions = session?.user?.permissions as string[] | undefined;

    // Collect all organization IDs the user can access (owned + active member).
    // Always keep the resolved list — INCLUDING when it is empty. An empty array is a positive
    // "this user belongs to zero organizations", which must fail closed below (and in the RLS
    // engine). Collapsing it to `undefined` would be read as "membership unknown" and skip
    // enforcement — letting a user with no memberships keep a caller-supplied org id.
    let memberOrganizationIds: string[] | undefined;
    if (userId) {
        try {
            memberOrganizationIds = await OrganizationMember.organizationIdsForUser(userId);
        } catch {
            // If tables don't exist yet (e.g. before migrations), leave undefined so membership
            // is treated as unknown (no-op) rather than "no orgs" (deny everything).
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

    // Group IDs the user can access (active memberships + groups they created). Powers the
    // membership-scoped RLS for user_groups / user_group_members, resolved against the final
    // organizationId so it is scoped to the active org.
    let memberGroupIds: string[] | undefined;
    if (userId) {
        try {
            memberGroupIds = await UserGroup.groupIdsForUser(userId, organizationId ?? undefined);
        } catch {
            // Tables may not exist yet (before migrations) — leave undefined (RLS treats as unknown).
        }
    }

    return {
        userId,
        organizationId,
        appId,
        roles,
        permissions,
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
