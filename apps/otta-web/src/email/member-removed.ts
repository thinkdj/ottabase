// ============================================================
// Transactional email: member removed from organization.
// Notifies a user when they've been removed from an organization.
// ============================================================

function escapeHtml(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface MemberRemovedEmailOpts {
    organizationName: string;
    memberName: string;
    role: string;
    reason?: string;
    contactEmail?: string;
}

export interface MemberRemovedEmailPayload {
    subject: string;
    template: 'minimalist';
    variables: { subject: string };
    content: { header: string; body: string; footer: string };
}

const REASON_LABELS: Record<string, string> = {
    left_company: 'Left the company',
    role_change: 'Role change',
    contract_ended: 'Contract ended',
    security_concern: 'Security concern',
    duplicate_account: 'Duplicate account',
    other: 'Other reason',
};

export function buildMemberRemovedEmail(opts: MemberRemovedEmailOpts): MemberRemovedEmailPayload {
    const subject = `Access removed from ${opts.organizationName}`;
    
    let body = `<p>Hello <strong>${escapeHtml(opts.memberName)}</strong>,</p>`;
    
    body += `<p>Your access to <strong>${escapeHtml(opts.organizationName)}</strong> has been removed. `;
    body += `You no longer have <strong>${escapeHtml(opts.role)}</strong> permissions.</p>`;
    
    if (opts.reason && REASON_LABELS[opts.reason]) {
        body += `<p style="color:#64748b;font-size:14px"><strong>Reason:</strong> ${escapeHtml(REASON_LABELS[opts.reason])}</p>`;
    }
    
    body += `<p>If you believe this was done in error or have any questions, please contact your organization administrator.</p>`;

    let footer = 'This notification is for your records.';
    if (opts.contactEmail) {
        footer += ` For assistance, contact <a href="mailto:${escapeHtml(opts.contactEmail)}">${escapeHtml(opts.contactEmail)}</a>.`;
    }

    return {
        subject,
        template: 'minimalist',
        variables: { subject },
        content: {
            header: '',
            body,
            footer,
        },
    };
}
