// ============================================================
// @ottabase/auth - Magic Link (Email) Senders
// ============================================================

import { sendTemplatedEmail } from '@ottabase/email/mailer';
import { createDevEmailTrapMailer, type DevEmailTrapStore } from '@ottabase/email/providers/dev-trap';
import { createResendMailer } from '@ottabase/email/providers/resend';
import type { ProviderEnv } from './types';

export type { DevEmailTrapAddress, DevEmailTrapMessage, DevEmailTrapStore } from '@ottabase/email/providers/dev-trap';

export interface MagicLinkSendParams {
    identifier: string;
    url: string;
    expires?: Date;
}

export interface MagicLinkSender {
    id: 'email';
    send: (params: MagicLinkSendParams) => Promise<void>;
}

export interface MagicLinkTemplateOptions {
    from?: string;
    subject?: string;
    appName?: string;
}

function renderMagicLinkEmail(url: string, expires: Date | undefined, appName: string) {
    const expiresAt = expires ? expires.toISOString() : '';
    return {
        header: `Sign in to ${appName}`,
        body:
            '<p>Hello,</p>' +
            '<p>Click the link below to sign in:</p>' +
            `<p><a href="${url}">Sign in</a></p>`,
        footer: expiresAt ? `<p>This link expires at ${expiresAt}.</p>` : undefined,
    };
}

function parseBoolean(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return false;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isDevEmailTrapConfigured(env: ProviderEnv): boolean {
    return parseBoolean(env.DEV_EMAIL_TRAP_ENABLED) && !!env.OBCF_KV;
}

export function createResendMagicLinkSender(env: ProviderEnv, options: MagicLinkTemplateOptions = {}): MagicLinkSender {
    const from = options.from || env.EMAIL_FROM || 'noreply@example.com';
    const appName = options.appName || 'Ottabase';
    const mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY || '' });

    return {
        id: 'email',
        async send({ identifier, url, expires }) {
            const result = await sendTemplatedEmail(mailer, {
                from,
                to: identifier,
                template: 'default',
                subject: options.subject || `Sign in to ${appName}`,
                variables: { url, email: identifier, appName },
                content: renderMagicLinkEmail(url, expires, appName),
            });
            if (!result.success) {
                throw new Error(result.error || 'Failed to send magic link email');
            }
        },
    };
}

export function createNodemailerMagicLinkSender(
    env: ProviderEnv,
    options: MagicLinkTemplateOptions = {},
): MagicLinkSender {
    const from = options.from || env.EMAIL_FROM || 'noreply@example.com';
    const appName = options.appName || 'Ottabase';

    // Lazily import Nodemailer only when a magic link is actually sent over SMTP, so the
    // (Node-only, heavy) Nodemailer chain is never bundled into Workers that use Resend
    // or the dev trap. The import is memoized per sender instance.
    const loadNodemailer = async () => {
        const { createNodemailerMailer } = await import('@ottabase/email/providers/nodemailer');
        return createNodemailerMailer({ server: env.EMAIL_SERVER || '' });
    };
    let mailerPromise: ReturnType<typeof loadNodemailer> | null = null;

    return {
        id: 'email',
        async send({ identifier, url, expires }) {
            if (!mailerPromise) mailerPromise = loadNodemailer();
            const mailer = await mailerPromise;
            const result = await sendTemplatedEmail(mailer, {
                from,
                to: identifier,
                template: 'default',
                subject: options.subject || `Sign in to ${appName}`,
                variables: { url, email: identifier, appName },
                content: renderMagicLinkEmail(url, expires, appName),
            });
            if (!result.success) {
                throw new Error(result.error || 'Failed to send magic link email');
            }
        },
    };
}

export function createDevEmailTrapMagicLinkSender(
    env: ProviderEnv,
    options: MagicLinkTemplateOptions & { store: Pick<DevEmailTrapStore, 'storeMessage'> },
): MagicLinkSender {
    const from = options.from || env.EMAIL_FROM || 'noreply@example.com';
    const appName = options.appName || 'Ottabase';
    const mailer = createDevEmailTrapMailer({ store: options.store });

    return {
        id: 'email',
        async send({ identifier, url, expires }) {
            const result = await sendTemplatedEmail(mailer, {
                from,
                to: identifier,
                template: 'default',
                subject: options.subject || `Sign in to ${appName}`,
                variables: { url, email: identifier, appName },
                content: renderMagicLinkEmail(url, expires, appName),
            });
            if (!result.success) {
                throw new Error(result.error || 'Failed to capture magic link email');
            }
        },
    };
}
