import { createResendMailer, createSESMailer, type Mailer } from '@ottabase/email';
import {
    createDevEmailTrapMailer,
    createKvEmailTrapStore,
    type DevEmailTrapStore,
} from '@ottabase/email/providers/dev-trap';
import { isDevEmailTrapConfigured } from '@ottabase/auth/providers';
import type { CloudflareEnv } from '../../cloudflare-env';

export type AppEmailProvider = 'auto' | 'dev-trap' | 'resend' | 'ses' | 'nodemailer';
export type ResolvedEmailProvider = Exclude<AppEmailProvider, 'auto'>;

export interface ResolvedMailerResult {
    mailer: Mailer | null;
    from: string;
    provider: ResolvedEmailProvider | null;
    error?: string;
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.floor(parsed);
}

export function isDevTrapAvailable(env: CloudflareEnv): boolean {
    return isDevEmailTrapConfigured(env as any) && !!env.OBCF_KV;
}

export function getDevEmailTrapStore(env: CloudflareEnv): DevEmailTrapStore | null {
    if (!isDevTrapAvailable(env) || !env.OBCF_KV) {
        return null;
    }

    return createKvEmailTrapStore(env.OBCF_KV as any, {
        maxEntries: toPositiveInteger(env.DEV_EMAIL_TRAP_MAX_EMAILS, 50),
    });
}

export async function resolveAppMailer(
    env: CloudflareEnv,
    preferredProvider: AppEmailProvider = 'auto',
): Promise<ResolvedMailerResult> {
    const from = env.EMAIL_FROM || 'noreply@example.com';

    if ((preferredProvider === 'dev-trap' || preferredProvider === 'auto') && isDevTrapAvailable(env)) {
        const store = getDevEmailTrapStore(env);
        if (store) {
            return {
                mailer: createDevEmailTrapMailer({ store }),
                from,
                provider: 'dev-trap',
            };
        }
    } else if (preferredProvider === 'dev-trap') {
        return {
            mailer: null,
            from,
            provider: null,
            error: 'Dev email trap requires DEV_EMAIL_TRAP_ENABLED and OBCF_KV',
        };
    }

    if ((preferredProvider === 'nodemailer' || preferredProvider === 'auto') && env.EMAIL_SERVER) {
        const { createNodemailerMailer } = await import('@ottabase/email/providers/nodemailer');
        return {
            mailer: createNodemailerMailer({ server: env.EMAIL_SERVER }),
            from,
            provider: 'nodemailer',
        };
    }

    if (preferredProvider === 'nodemailer') {
        return {
            mailer: null,
            from,
            provider: null,
            error: 'EMAIL_SERVER must be configured for Nodemailer provider',
        };
    }

    if (
        (preferredProvider === 'ses' || preferredProvider === 'auto') &&
        env.AWS_ACCESS_KEY_ID &&
        env.AWS_SECRET_ACCESS_KEY
    ) {
        return {
            mailer: createSESMailer({
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                region: env.AWS_REGION || 'us-east-1',
            }),
            from,
            provider: 'ses',
        };
    }

    if (preferredProvider === 'ses') {
        return {
            mailer: null,
            from,
            provider: null,
            error: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured for SES provider',
        };
    }

    if ((preferredProvider === 'resend' || preferredProvider === 'auto') && env.EMAIL_RESEND_API_KEY) {
        return {
            mailer: createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY }),
            from,
            provider: 'resend',
        };
    }

    if (preferredProvider === 'resend') {
        return {
            mailer: null,
            from,
            provider: null,
            error: 'EMAIL_RESEND_API_KEY must be configured for Resend provider',
        };
    }

    return {
        mailer: null,
        from,
        provider: null,
        error: 'No email provider configured. Set DEV_EMAIL_TRAP_ENABLED, EMAIL_SERVER, EMAIL_RESEND_API_KEY, or AWS SES credentials',
    };
}
