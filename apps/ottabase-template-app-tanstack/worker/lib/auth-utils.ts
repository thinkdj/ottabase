import { CreateAuthConfigOptions } from '@ottabase/auth/backend';
import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { createResendMailer, createSESMailer } from '@ottabase/email';
import { SecurityContext } from '@ottabase/ottaorm';
import { Account, Organization, OrganizationMember, VerificationToken } from '@ottabase/ottaorm/models';
import type { CloudflareEnv } from '../../cloudflare-env';
import { createSecureToken } from './utils';
import {
    AUTH_DISABLE_CREDENTIALS,
    AUTH_REQUIRE_EMAIL_VERIFIED,
    AUTH_SESSION_MAX_AGE,
    AUTH_VERBOSE,
    EMAIL_FROM_DEFAULT,
    EMAIL_SES_REGION,
} from './worker-config';

function parseBoolOverride(value: unknown): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return undefined;
}

function resolveSessionMaxAge(env: CloudflareEnv): number {
    const envVal = Number((env as any).AUTH_SESSION_MAX_AGE);
    if (Number.isFinite(envVal) && envVal > 0) return envVal;
    return AUTH_SESSION_MAX_AGE;
}

export function resolveAuthBehavior(env: CloudflareEnv) {
    return {
        sessionMaxAge: resolveSessionMaxAge(env),
        requireEmailVerified:
            parseBoolOverride((env as any).AUTH_REQUIRE_EMAIL_VERIFIED) ?? AUTH_REQUIRE_EMAIL_VERIFIED,
        disableCredentials: parseBoolOverride((env as any).AUTH_DISABLE_CREDENTIALS) ?? AUTH_DISABLE_CREDENTIALS,
        verbose: parseBoolOverride((env as any).AUTH_VERBOSE) ?? AUTH_VERBOSE,
    };
}

export async function resolveMailer(env: CloudflareEnv) {
    // Prefer env override for backward compatibility; fall back to config default
    const from = env.EMAIL_FROM && env.EMAIL_FROM.trim().length > 0 ? env.EMAIL_FROM : EMAIL_FROM_DEFAULT;
    let mailer: any = null;
    let provider: 'resend' | 'ses' | 'nodemailer' | null = null;

    if (env.EMAIL_RESEND_API_KEY) {
        mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY });
        provider = 'resend';
    } else if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
        mailer = createSESMailer({
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            // Prefer env override for backward compatibility; fall back to config default
            region: env.AWS_REGION || EMAIL_SES_REGION,
        });
        provider = 'ses';
    } else if (env.EMAIL_SERVER) {
        const { createNodemailerMailer } = await import('@ottabase/email/providers/nodemailer');
        mailer = createNodemailerMailer({ server: env.EMAIL_SERVER });
        provider = 'nodemailer';
    }

    return { mailer, from, provider };
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

export function getAuthOptions(env: CloudflareEnv): CreateAuthConfigOptions {
    const behavior = resolveAuthBehavior(env);

    const options: CreateAuthConfigOptions = {
        authConfig: {
            pages: {
                signIn: '/login',
                error: '/login',
            },
        },
    };

    options.sessionMaxAge = behavior.sessionMaxAge;

    if (behavior.requireEmailVerified) {
        options.requireVerifiedEmail = true;
    }

    if (behavior.disableCredentials) {
        options.disableCredentials = true;
    }

    if (behavior.verbose) {
        options.verbose = true;
    }

    // Clear RBAC cache when user signs out so stale permissions aren't served
    options.onSignOut = async (_userId: string) => {
        if (!env.OBCF_KV) return;
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    };

    return options;
}

export async function getSecurityContext(request: Request, session: any | null): Promise<SecurityContext> {
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

    const appId = request.headers.get('x-app-id') || 'web';
    const roles = session?.user?.roles as string[] | undefined;
    const permissions = session?.user?.permissions as string[] | undefined;

    // Collect all organization IDs the user can access (owned + member)
    let memberOrganizationIds: string[] | undefined;
    if (userId) {
        try {
            const orgIds = new Set<string>();

            // Orgs where user is an active member
            const memberships = await OrganizationMember.where({ userId, status: 'active' });
            for (const m of memberships) {
                const oid = m.get('organizationId') as string | undefined;
                if (oid) orgIds.add(oid);
            }

            // Orgs owned by the user
            const owned = await Organization.where({ ownerId: userId });
            for (const o of owned) {
                const oid = o.get('id') as string | undefined;
                if (oid) orgIds.add(oid);
            }

            if (orgIds.size > 0) {
                memberOrganizationIds = Array.from(orgIds);
            }
        } catch {
            // If tables don't exist yet (e.g. before migrations), silently skip
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
