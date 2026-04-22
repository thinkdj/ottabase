# Member Email Notifications

Email notifications for organization member lifecycle events.

## Overview

Automated email notifications are sent to members when they are:
- **Added to an organization** - Welcome email with role and access information
- **Removed from an organization** - Offboarding notification (optional, controlled by UI toggle)

## Email Templates

### Member Added Email

**Trigger**: When a member is added via `handleAdminOrganizationInviteMember`

**Subject**: "Welcome to {organizationName}"

**Content**:
- Personalized greeting with member name
- Who invited them (if available)
- Their assigned role (owner, admin, member, viewer)
- Dashboard access button
- Contact information footer

**Example**:
```
Hello Jane Smith,

John Doe has added you to Acme Corp as admin.

You now have access to all resources and features available to your role.

[Access Dashboard]

If you have any questions, please contact your organization administrator.
```

### Member Removed Email

**Trigger**: When a member is removed via `handleAdminOrganizationRemoveMember` with `notifyMember: true`

**Subject**: "Access removed from {organizationName}"

**Content**:
- Notification about access removal
- Their former role
- Optional removal reason (if provided)
- Contact information for questions
- Professional and respectful tone

**Removal Reasons** (mapped from codes):
- `left_company` → "Left the company"
- `role_change` → "Role change"
- `contract_ended` → "Contract ended"
- `security_concern` → "Security concern"
- `duplicate_account` → "Duplicate account"
- `other` → "Other reason"

**Example**:
```
Hello Jane Smith,

Your access to Acme Corp has been removed. You no longer have admin permissions.

Reason: Left the company

If you believe this was done in error or have any questions, please contact your organization administrator.

This notification is for your records. For assistance, contact support@example.com.
```

## Implementation

### Email Builders

Located in `apps/otta-web/src/email/`:

**`member-added.ts`**
```typescript
buildMemberAddedEmail({
    organizationName: string;
    inviterName?: string;
    memberName: string;
    role: string;
    dashboardUrl?: string;
}): MemberAddedEmailPayload
```

**`member-removed.ts`**
```typescript
buildMemberRemovedEmail({
    organizationName: string;
    memberName: string;
    role: string;
    reason?: string;
    contactEmail?: string;
}): MemberRemovedEmailPayload
```

### Email Senders

Located in `apps/otta-web/worker/lib/member-emails.ts`:

**`sendMemberAddedEmail()`** - Sends welcome email
**`sendMemberRemovedEmail()`** - Sends offboarding notification

Both functions:
- Use the existing email engine (`@ottabase/email`)
- Auto-select email provider (dev-trap, resend, SES, nodemailer)
- Render templates using Handlebars
- Return `{ ok: boolean; error?: string }`

### Integration Points

**Member Add** (`admin-organization-members.ts` line ~160):
```typescript
// Automatically sends after member is added
if (user.email) {
    const organization = await Organization.find(organizationId);
    await sendMemberAddedEmail(context.env, context.request, {
        to: user.email,
        organizationName: organization?.name || 'the organization',
        inviterName: auth.user?.name || undefined,
        memberName: user.name || user.email,
        role,
        dashboardUrl,
    });
}
```

**Member Removal** (`admin-organization-members.ts` line ~315):
```typescript
// Only sends if notifyMember flag is true (from offboarding dialog)
if (offboardingData.notifyMember && existingMember.user?.email) {
    const organization = await Organization.find(organizationId);
    await sendMemberRemovedEmail(context.env, context.request, {
        to: existingMember.user.email,
        organizationName: organization?.name || 'the organization',
        memberName: existingMember.user.name || existingMember.user.email,
        role: existingMember.role,
        reason: offboardingData.reason,
        contactEmail: auth.user?.email || undefined,
    });
}
```

## UI Integration

### Member Offboarding Dialog

The member removal email is controlled by a checkbox in the `MemberOffboardingDialog` component:

- ✅ **Checkbox checked** (default): Email notification sent
- ⬜ **Checkbox unchecked**: No email notification sent

The checkbox state is passed to the backend via the `notifyMember` boolean parameter.

## Email Provider Configuration

Emails use the existing email engine which supports:

1. **Dev Email Trap** (development) - Captures emails in KV store
2. **Resend** - Set `EMAIL_RESEND_API_KEY`
3. **AWS SES** - Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
4. **Nodemailer** - Set `EMAIL_SERVER`

The system automatically selects the first available provider.

## Testing

### Unit Tests

Run tests: `cd apps/otta-web && npx vitest run src/email/__tests__/member-emails.test.ts`

Tests cover:
- Email content generation with all fields
- Email content without optional fields
- HTML escaping (XSS prevention)
- Reason code mapping
- Template structure

### Manual Testing

Use the email test endpoint:

```bash
# Test member added email
curl -X POST http://localhost:3004/api/email/test \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["test@example.com"],
    "template": "minimalist",
    "subject": "Welcome to Acme Corp",
    "content": {
      "body": "<p>Welcome email content...</p>"
    }
  }'
```

### Dev Email Trap

In development, emails are captured in KV storage and can be viewed via the admin panel (if configured).

## Security Considerations

1. **HTML Escaping**: All user input is escaped to prevent XSS attacks
2. **Email Validation**: Only sends to valid email addresses
3. **Privacy**: Removal emails don't expose sensitive organizational data
4. **Audit Trail**: All email sends are logged in audit log metadata

## Future Enhancements

- Admin notification emails (when member added/removed)
- Customizable email templates per organization
- Email preference management for members
- Batch notifications for multiple member changes
- Rich email templates with organization branding
