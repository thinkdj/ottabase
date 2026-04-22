import { describe, it, expect } from 'vitest';
import { buildMemberAddedEmail } from '../member-added';
import { buildMemberRemovedEmail } from '../member-removed';

describe('buildMemberAddedEmail', () => {
    it('includes organization, role, inviter and dashboard link', () => {
        const result = buildMemberAddedEmail({
            organizationName: 'Acme Corp',
            inviterName: 'John Doe',
            memberName: 'Jane Smith',
            role: 'admin',
            dashboardUrl: 'https://example.com/dashboard',
        });

        expect(result.subject).toBe('Welcome to Acme Corp');
        expect(result.template).toBe('minimalist');
        expect(result.content.body).toContain('John Doe');
        expect(result.content.body).toContain('Acme Corp');
        expect(result.content.body).toContain('admin');
        expect(result.content.body).toContain('https://example.com/dashboard');
    });

    it('omits inviter phrasing when inviter is missing', () => {
        const result = buildMemberAddedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane',
            role: 'member',
        });

        expect(result.content.body).toContain('You have been added to');
        expect(result.content.body).not.toContain('added you to');
    });

    it('omits the CTA when dashboardUrl is missing', () => {
        const result = buildMemberAddedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane',
            role: 'viewer',
        });

        expect(result.content.body).not.toContain('Open dashboard');
    });

    it('escapes HTML in all user-controlled fields (including URL)', () => {
        const result = buildMemberAddedEmail({
            organizationName: '<script>x</script>',
            inviterName: '<b>J</b>',
            memberName: 'Jane & Co',
            role: 'admin',
            dashboardUrl: 'https://ex.com/"><script>x</script>',
        });

        expect(result.content.body).not.toContain('<script>x</script>');
        expect(result.content.body).toContain('&lt;script&gt;');
        expect(result.content.body).toContain('&lt;b&gt;J&lt;/b&gt;');
        // URL is escaped so it cannot break out of the href attribute
        expect(result.content.body).not.toContain('"><script>');
        expect(result.content.body).toContain('&quot;&gt;&lt;script&gt;');
    });
});

describe('buildMemberRemovedEmail', () => {
    it('includes organization, role and mapped reason label', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane',
            role: 'admin',
            reason: 'left_company',
        });

        expect(result.subject).toBe('Access removed from Acme Corp');
        expect(result.template).toBe('minimalist');
        expect(result.content.body).toContain('Acme Corp');
        expect(result.content.body).toContain('admin');
        expect(result.content.body).toContain('Left the company');
    });

    it('omits the reason line when reason is missing', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane',
            role: 'member',
        });

        expect(result.content.body).not.toContain('Reason:');
    });

    it('maps all whitelisted reason codes', () => {
        const cases: Array<[string, string]> = [
            ['left_company', 'Left the company'],
            ['role_change', 'Role change'],
            ['contract_ended', 'Contract ended'],
            ['security_concern', 'Security concern'],
            ['duplicate_account', 'Duplicate account'],
            ['other', 'Other'],
        ];
        for (const [code, label] of cases) {
            const result = buildMemberRemovedEmail({
                organizationName: 'Acme',
                memberName: 'Jane',
                role: 'member',
                reason: code,
            });
            expect(result.content.body).toContain(label);
        }
    });

    it('drops unknown reason codes (no arbitrary text echo)', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme',
            memberName: 'Jane',
            role: 'member',
            reason: '<script>alert(1)</script>',
        });

        expect(result.content.body).not.toContain('Reason:');
        expect(result.content.body).not.toContain('<script>');
    });

    it('escapes HTML in all user-controlled fields', () => {
        const result = buildMemberRemovedEmail({
            organizationName: '<script>x</script>',
            memberName: 'Jane & Co',
            role: '<b>admin</b>',
        });

        expect(result.content.body).not.toContain('<script>x</script>');
        expect(result.content.body).toContain('&lt;script&gt;');
        expect(result.content.body).toContain('&lt;b&gt;admin&lt;/b&gt;');
    });

    it('does not include the admin contact email (privacy)', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme',
            memberName: 'Jane',
            role: 'member',
            reason: 'other',
        });

        expect(result.content.footer).not.toContain('mailto:');
        expect(result.content.footer).not.toContain('@');
    });
});
