// ============================================================
// Transactional email: member added to organization.
// Notifies a user when they've been added as a member.
// ============================================================

function escapeHtml(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
    
    let body = `<p>Hello <strong>${escapeHtml(opts.memberName)}</strong>,</p>`;
    
    if (opts.inviterName) {
        body += `<p><strong>${escapeHtml(opts.inviterName)}</strong> has added you to ` +
                `<strong>${escapeHtml(opts.organizationName)}</strong> ` +
                `as <strong>${escapeHtml(opts.role)}</strong>.</p>`;
    } else {
        body += `<p>You have been added to <strong>${escapeHtml(opts.organizationName)}</strong> ` +
                `as <strong>${escapeHtml(opts.role)}</strong>.</p>`;
    }
    
    body += `<p>You now have access to all resources and features available to your role.</p>`;
    
    if (opts.dashboardUrl) {
        body += `<p><a href="${opts.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Access Dashboard</a></p>`;
    }

    return {
        subject,
        template: 'minimalist',
        variables: { subject },
        content: {
            header: '',
            body,
            footer: 'If you have any questions, please contact your organization administrator.',
        },
    };
}
