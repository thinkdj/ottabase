// ============================================================
// Transactional email: member added to organization.
// Notifies a user when they've been added as a member.
// ============================================================

import { escapeHtml } from './_utils';

export interface MemberAddedEmailOpts {
    organizationName: string;
    inviterName?: string;
    memberName: string;
    role: string;
    dashboardUrl?: string;
}

export interface MemberAddedEmailPayload {
    subject: string;
    template: 'minimalist';
    variables: { subject: string };
    content: { header: string; body: string; footer: string };
}

export function buildMemberAddedEmail(opts: MemberAddedEmailOpts): MemberAddedEmailPayload {
    const subject = `Welcome to ${opts.organizationName}`;

    const intro = opts.inviterName
        ? `<p><strong>${escapeHtml(opts.inviterName)}</strong> added you to ` +
          `<strong>${escapeHtml(opts.organizationName)}</strong> as <strong>${escapeHtml(opts.role)}</strong>.</p>`
        : `<p>You have been added to <strong>${escapeHtml(opts.organizationName)}</strong> ` +
          `as <strong>${escapeHtml(opts.role)}</strong>.</p>`;

    const cta = opts.dashboardUrl ? `<p><a href="${escapeHtml(opts.dashboardUrl)}">Open dashboard</a></p>` : '';

    return {
        subject,
        template: 'minimalist',
        variables: { subject },
        content: {
            header: '',
            body: intro + cta,
            footer: 'If you did not expect this email, you can ignore it.',
        },
    };
}
