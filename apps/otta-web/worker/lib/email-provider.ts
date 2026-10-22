import { createResendMailer, createSESMailer, type EmailAddress, type Mailer } from '@ottabase/email';
import {
    createDevEmailTrapMailer,
    createKvEmailTrapStore,
    type DevEmailTrapStore,
} from '@ottabase/email/providers/dev-trap';
import { isDevEmailTrapConfigured } from '@ottabase/auth/providers';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { User } from '@ottabase/ottaorm/models';
import { isDemoMode } from './utils';

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

/** The dev-mail store: the dev trap's inbox, and on a public demo the mail held from strangers. */
export function getDevEmailTrapStore(env: CloudflareEnv): DevEmailTrapStore | null {
    if (!env.OBCF_KV || !(isDevTrapAvailable(env) || isDemoMode(env))) {
        return null;
    }

    return createKvEmailTrapStore(env.OBCF_KV as any, {
        maxEntries: toPositiveInteger(env.DEV_EMAIL_TRAP_MAX_EMAILS, 50),
    });
}

/**
 * The app's one outbound mail resolver. On a public demo (`DEMO_MODE`) every real transport is
 * wrapped by {@link holdMailToStrangers}; the dev trap already sends nothing, so it is left as is.
 */
export async function resolveAppMailer(
    env: CloudflareEnv,
    preferredProvider: AppEmailProvider = 'auto',
): Promise<ResolvedMailerResult> {
    const result = await resolveTransport(env, preferredProvider);
    if (!result.mailer || result.provider === 'dev-trap' || !isDemoMode(env)) return result;
    return {
        ...result,
        mailer: holdMailToStrangers(result.mailer, getDevEmailTrapStore(env), (email) => hasAccount(env, email)),
    };
}

function addressesOf(value: EmailAddress | EmailAddress[] | undefined): string[] {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]).map((address) =>
        (typeof address === 'string' ? address : address.email).trim().toLowerCase(),
    );
}

/**
 * Demo mail policy: deliver only when every recipient (to, cc and bcc) holds an account here,
 * which covers sign-up verification, password resets, an invite to an existing member and a reply
 * to someone's own ticket. Any other message is held in the dev-mail store (Admin → Dev mail) and
 * reported as sent, never delivered, so typed-in addresses (an org invite to a stranger, a status
 * page subscriber) cannot turn a public demo into a mail relay. A lookup failure holds the mail.
 */
export function holdMailToStrangers(
    mailer: Mailer,
    store: Pick<DevEmailTrapStore, 'storeMessage'> | null,
    isAccount: (email: string) => Promise<boolean>,
): Mailer {
    const held = store ? createDevEmailTrapMailer({ store, providerName: 'demo-held' }) : null;
    return {
        provider: mailer.provider,
        async send(input) {
            const recipients = [...addressesOf(input.to), ...addressesOf(input.cc), ...addressesOf(input.bcc)];
            let deliverable = recipients.length > 0;
            for (const email of recipients) {
                if (!deliverable) break;
                deliverable = await isAccount(email).catch(() => false);
            }
            if (deliverable) return mailer.send(input);

            console.warn(JSON.stringify({ event: 'demo_mail_held', recipients: recipients.length }));
            // Reported as sent: a failure would make queued senders (Beacon, Helpdesk) retry forever.
            return held ? held.send(input) : { provider: 'demo-held', success: true };
        },
    };
}

async function hasAccount(env: CloudflareEnv, email: string): Promise<boolean> {
    if (!env.OBCF_D1) return false;
    registerConnection('default', createD1Driver(env.OBCF_D1));
    return Boolean(await User.findByEmail(email));
}

async function resolveTransport(
    env: CloudflareEnv,
    preferredProvider: AppEmailProvider,
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
