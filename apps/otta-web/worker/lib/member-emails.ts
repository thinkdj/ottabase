// Thin wrappers around the shared mailer for member lifecycle emails.
// Mirrors the pattern used by admin-organization-invites.ts.

import { sendTemplatedEmail } from '@ottabase/email';
import type { CloudflareEnv } from '../../cloudflare-env';
import { buildMemberAddedEmail, type MemberAddedEmailOpts } from '../../src/email/member-added';
import { buildMemberRemovedEmail, type MemberRemovedEmailOpts } from '../../src/email/member-removed';
import { registerAppEmailTemplates } from '../../src/email/templates';
import { resolveMailer } from './auth-utils';

type SendResult = { ok: boolean; error?: string };

// Accepts the return type of either builder. Both produce the templated-email
// payload shape (template/variables/subject/content) consumed by sendTemplatedEmail.
type MemberEmailPayload = ReturnType<typeof buildMemberAddedEmail> | ReturnType<typeof buildMemberRemovedEmail>;

async function send(env: CloudflareEnv, to: string, payload: MemberEmailPayload): Promise<SendResult> {
    registerAppEmailTemplates();
    const { mailer, from } = await resolveMailer(env);
    if (!mailer || !from) {
        return { ok: false, error: 'No email provider configured' };
    }
    try {
        await sendTemplatedEmail(mailer, { from, to, ...payload });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
    }
}

export function sendMemberAddedEmail(
    env: CloudflareEnv,
    opts: MemberAddedEmailOpts & { to: string },
): Promise<SendResult> {
    return send(env, opts.to, buildMemberAddedEmail(opts));
}

export function sendMemberRemovedEmail(
    env: CloudflareEnv,
    opts: MemberRemovedEmailOpts & { to: string },
): Promise<SendResult> {
    return send(env, opts.to, buildMemberRemovedEmail(opts));
}
