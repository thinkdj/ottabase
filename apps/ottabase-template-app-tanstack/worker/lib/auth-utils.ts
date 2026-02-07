import { createResendMailer, createSESMailer } from '@ottabase/email';
import { CreateAuthConfigOptions } from '@ottabase/auth/backend';
import { SecurityContext } from '@ottabase/ottaorm';
import { Account, Organization, OrganizationMember, VerificationToken } from '@ottabase/ottaorm/models';
import { createSecureToken } from './utils';
import type { CloudflareEnv } from '../cloudflare-env';

export async function resolveMailer(env: CloudflareEnv) {
    const from = env.EMAIL_FROM || 'noreply@example.com';
    let mailer: any = null;
    let provider: 'resend' | 'ses' | 'nodemailer' | null = null;

    if (env.EMAIL_RESEND_API_KEY) {
        mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY });
        provider = 'resend';
    } else if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
        mailer = createSESMailer({
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            region: env.AWS_REGION || 'us-east-1',
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
): Promise<{ token: string; expiresAt: string }> {
    if (!env.OBCF_D1) {
        throw new Error('D1 database binding not configured');
    }

    const token = createSecureToken(32);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

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
        const orgHeader = request.headers.get('x-organization-id');
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
): Promise<Array<{ provider: string; type: string; createdAt: string | null }>> {
    const accounts = await Account.forUser(userId);
    return accounts.map((account) => {
        const json = account.toJson();
        return {
            provider: json.provider ?? 'unknown',
            type: json.type ?? 'oauth',
            createdAt: json.createdAt ? new Date(json.createdAt).toISOString() : null,
        };
    });
}
