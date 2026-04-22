// ============================================================
// Transactional email: organization invite.
// Builds the subject + content payload consumed by the minimalist
// template. Keeping copy here (instead of inlined in route code)
// makes it reviewable without touching the handler.
// ============================================================

import { escapeHtml } from './_utils';

export interface OrgInviteEmailOpts {
    organizationName: string;
    inviterName: string;
    role: string;
    acceptUrl: string;
    expiresAt: number;
}

export interface OrgInviteEmailPayload {
    subject: string;
    template: 'minimalist';
    variables: { subject: string };
    content: { header: string; body: string; footer: string };
}

export function buildOrgInviteEmail(opts: OrgInviteEmailOpts): OrgInviteEmailPayload {
    const subject = `Invitation to ${opts.organizationName}`;
    const expiresAt = new Date(opts.expiresAt).toLocaleString();

    const body =
        `<p><strong>${escapeHtml(opts.inviterName)}</strong> invited you to join ` +
        `<strong>${escapeHtml(opts.organizationName)}</strong> as <strong>${escapeHtml(opts.role)}</strong>.</p>` +
        `<p><a href="${escapeHtml(opts.acceptUrl)}">Review invitation</a></p>` +
        `<p style="color:#64748b;font-size:13px">This link expires on ${escapeHtml(expiresAt)}.</p>`;

    return {
        subject,
        template: 'minimalist',
        variables: { subject },
        content: {
            header: '',
            body,
            footer: 'If you did not expect this email, you can ignore it.',
        },
    };
}
