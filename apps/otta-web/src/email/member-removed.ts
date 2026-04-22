// ============================================================
// Transactional email: member removed from organization.
// Notifies a user when they've been removed from an organization.
// ============================================================

import { escapeHtml } from './_utils';

export interface MemberRemovedEmailOpts {
    organizationName: string;
    memberName: string;
    role: string;
    reason?: string;
}

export interface MemberRemovedEmailPayload {
    subject: string;
    template: 'minimalist';
    variables: { subject: string };
    content: { header: string; body: string; footer: string };
}

// Whitelist of offboarding reason codes → human-readable labels.
// Any value not in this map is ignored (prevents arbitrary text from being echoed to the recipient).
const REASON_LABELS: Record<string, string> = {
    left_company: 'Left the company',
    role_change: 'Role change',
    contract_ended: 'Contract ended',
    security_concern: 'Security concern',
    duplicate_account: 'Duplicate account',
    other: 'Other',
};

export function buildMemberRemovedEmail(opts: MemberRemovedEmailOpts): MemberRemovedEmailPayload {
    const subject = `Access removed from ${opts.organizationName}`;

    const reasonLabel = opts.reason ? REASON_LABELS[opts.reason] : undefined;
    const reasonLine = reasonLabel
        ? `<p style="color:#64748b;font-size:13px"><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</p>`
        : '';

    const body =
        `<p>Your access to <strong>${escapeHtml(opts.organizationName)}</strong> ` +
        `as <strong>${escapeHtml(opts.role)}</strong> has been removed.</p>` +
        reasonLine;

    return {
        subject,
        template: 'minimalist',
        variables: { subject },
        content: {
            header: '',
            body,
            footer: 'If you believe this was done in error, please contact your organization administrator.',
        },
    };
}
