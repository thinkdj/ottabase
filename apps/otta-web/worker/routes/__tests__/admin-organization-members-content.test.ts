import { describe, expect, it } from 'vitest';
import { buildOrganizationInviteEmailContent } from '../admin-organization-members';

describe('organization invitation email content', () => {
    it('sanitizes tenant-controlled names and destination URLs before rendering HTML', () => {
        const content = buildOrganizationInviteEmailContent({
            organizationName: '<img src=x onerror="alert(1)">Acme\r\nBcc: attacker@example.com',
            destinationUrl: 'javascript:alert(1)',
            alreadyHasAccount: false,
        });

        expect(content.subject).toBe("You've been invited to join Acme Bcc: attacker@example.com");
        expect(content.header).toBe('Join Acme Bcc: attacker@example.com');
        expect(content.body).toContain('href="#"');
        expect(content.body).not.toMatch(/onerror|javascript:|<img/i);
    });
});
