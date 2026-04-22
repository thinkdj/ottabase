/**
 * Helper functions for sending member-related emails
 */

import { sendTemplatedEmail } from '@ottabase/email';
import { buildMemberAddedEmail, type MemberAddedEmailOpts } from '../../src/email/member-added';
import { buildMemberRemovedEmail, type MemberRemovedEmailOpts } from '../../src/email/member-removed';
import { registerAppEmailTemplates } from '../../src/email/templates';
import { resolveMailer } from './auth-utils';
import type { CloudflareEnv } from '../../cloudflare-env';

export async function sendMemberAddedEmail(
    env: CloudflareEnv,
    request: Request,
    opts: MemberAddedEmailOpts & { to: string },
): Promise<{ ok: boolean; error?: string }> {
    registerAppEmailTemplates();
    const { mailer, from } = await resolveMailer(env);
    
    if (!mailer || !from) {
        return { ok: false, error: 'No email provider configured' };
    }

    const payload = buildMemberAddedEmail(opts);

    try {
        await sendTemplatedEmail(mailer, {
            from,
            to: opts.to,
            ...payload,
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
    }
}

export async function sendMemberRemovedEmail(
    env: CloudflareEnv,
    request: Request,
    opts: MemberRemovedEmailOpts & { to: string },
): Promise<{ ok: boolean; error?: string }> {
    registerAppEmailTemplates();
    const { mailer, from } = await resolveMailer(env);
    
    if (!mailer || !from) {
        return { ok: false, error: 'No email provider configured' };
    }

    const payload = buildMemberRemovedEmail(opts);

    try {
        await sendTemplatedEmail(mailer, {
            from,
            to: opts.to,
            ...payload,
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
    }
}
