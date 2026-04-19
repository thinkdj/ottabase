import { CreateAuthConfigOptions } from '@ottabase/auth/backend';
import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { SecurityContext } from '@ottabase/ottaorm';
import { Account, Organization, User, VerificationToken } from '@ottabase/ottaorm/models';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import type { CloudflareEnv } from '../cloudflare-env';
import { initDbConnection } from './db-utils';
import { resolveAppMailer } from './email-provider';
import { provisionDefaultOrganizationForUser } from './user-provisioning';
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
    const expiresAt = Date.now() + ttlSeconds * 1000;

    try {
        await env.OBCF_D1.prepare(`DELETE FROM verification_tokens WHERE identifier = ?`).bind(identifier).run();
    } catch {
        // ignore cleanup errors
    }

    await VerificationToken.create({
        identifier,
        token,
        expires: expiresAt,
    });

    return { token, expiresAt };
}

function resolveAppId(env: CloudflareEnv): string {
    return getOttabaseConfig(env).appId ?? 'web';
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

    /**
     * Auto-provision a personal organization the first time a user signs in.
     * Runs serialized inside Auth.js's `signIn` callback so the jwt callback
     * (which runs right after) always sees a membership row.
     */
    options.onFirstSignIn = async (user) => {
        if (!env.OBCF_D1 || !user?.id) return;
        initDbConnection(env);
        try {
            const userRecord = await User.find(user.id);
            if (!userRecord) return;
            await provisionDefaultOrganizationForUser({
                user: userRecord as any,
                email: user.email ?? null,
                name: user.name ?? null,
                appId: resolveAppId(env),
            });
        } catch (err) {
            console.error('[auth] onFirstSignIn provisioning failed:', err);
        }
    };

    // Clear RBAC cache when user signs out so stale permissions aren't served
    options.onSignOut = async (_userId: string) => {
        if (!env.OBCF_KV) return;
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    };

    return options;
}

export async function getSecurityContext(
    request: Request,
    session: any | null,
    env?: CloudflareEnv,
): Promise<SecurityContext> {
    const url = new URL(request.url);
    const userId = session?.user?.id as string | undefined;

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

    // Collect every org the user can access (active memberships + owned).
    // Uses the fat-model helper so RLS policies receive the same list that
    // the rest of the app sees. Soft-fails when tables don't exist yet
    // (e.g. during bootstrap before migrations run).
    let memberOrganizationIds: string[] | undefined;
    if (userId) {
        try {
            const user = await User.find(userId);
            if (user) {
                const [memberOrgs, ownedOrgs] = await Promise.all([
                    user.organizations({ status: 'active' }),
                    Organization.where({ ownerId: userId }),
                ]);
                const ids = new Set<string>();
                for (const o of memberOrgs) {
                    const id = o.get('id') as string | undefined;
                    if (id) ids.add(id);
                }
                for (const o of ownedOrgs) {
                    const id = o.get('id') as string | undefined;
                    if (id) ids.add(id);
                }
                if (ids.size > 0) memberOrganizationIds = Array.from(ids);
            }
        } catch {
            // Tables not ready yet — treat as empty; RLS will fall back to ownerId matching.
        }
    }

    return {
        userId,
        organizationId,
        appId,
        roles,
        permissions,
        memberOrganizationIds,
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
