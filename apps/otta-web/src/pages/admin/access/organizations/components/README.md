# Member Offboarding Dialog

Enhanced member removal dialog component for organization member management.

## Features

- **Member Information Display**: Shows member name, email, and role before removal
- **Confirmation Typing**: Requires typing the member's name to confirm removal (prevents accidental deletions)
- **Reason Selection**: Optional dropdown to select removal reason (tracked in audit log)
- **Email Notification**: Toggle to send notification email to departing member
- **Dark Mode Support**: Fully styled for both light and dark themes
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Usage

```tsx
import { MemberOffboardingDialog } from './components/MemberOffboardingDialog';

function MyComponent() {
    const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberRecord | null>(null);

    const handleOffboarding = (options: { reason?: string; notifyMember: boolean }) => {
        // Handle member removal
        console.log('Removing member with reason:', options.reason);
        console.log('Send notification:', options.notifyMember);
    };

    return (
        <MemberOffboardingDialog
            open={!!memberToRemove}
            onOpenChange={(open) => !open && setMemberToRemove(null)}
            member={memberToRemove}
            onConfirm={handleOffboarding}
            isPending={false}
        />
    );
}
```

## Props

- `open` (boolean): Controls dialog visibility
- `onOpenChange` (function): Callback when dialog open state changes
- `member` (OrganizationMemberRecord | null): Member to be removed
- `onConfirm` (function): Callback with offboarding options `{ reason?: string; notifyMember: boolean }`
- `isPending` (boolean, optional): Shows loading state during removal

## Offboarding Reasons

The following predefined reasons are available:
- Left the company
- Role change
- Contract ended
- Security concern
- Duplicate account
- Other reason

## Backend Integration

The backend endpoint accepts the following in the DELETE request body:

```json
{
  "reason": "left_company",
  "notifyMember": true
}
```

These values are stored in the audit log metadata for compliance and tracking:

```typescript
metadata: {
    removedUser: "user@example.com",
    removedUserRole: "member",
    offboardingReason: "left_company",
    notificationSent: true,
}
```

## Future Enhancements

- Email notification implementation (currently TODO)
- Data export before removal (GDPR compliance)
- Resource transfer wizard
- Soft delete option (vs hard delete)
- Bulk member offboarding
