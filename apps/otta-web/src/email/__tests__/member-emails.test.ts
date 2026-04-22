/**
 * Tests for member email builders
 */

import { describe, it, expect } from 'vitest';
import { buildMemberAddedEmail } from '../member-added';
import { buildMemberRemovedEmail } from '../member-removed';

describe('buildMemberAddedEmail', () => {
    it('should build email with all fields', () => {
        const result = buildMemberAddedEmail({
            organizationName: 'Acme Corp',
            inviterName: 'John Doe',
            memberName: 'Jane Smith',
            role: 'admin',
            dashboardUrl: 'https://example.com/dashboard',
        });

        expect(result.subject).toBe('Welcome to Acme Corp');
        expect(result.template).toBe('minimalist');
        expect(result.content.body).toContain('Jane Smith');
        expect(result.content.body).toContain('John Doe');
        expect(result.content.body).toContain('Acme Corp');
        expect(result.content.body).toContain('admin');
        expect(result.content.body).toContain('https://example.com/dashboard');
        expect(result.content.body).toContain('Access Dashboard');
        expect(result.content.footer).toContain('contact your organization administrator');
    });

    it('should build email without inviter name', () => {
        const result = buildMemberAddedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane Smith',
            role: 'member',
        });

        expect(result.subject).toBe('Welcome to Acme Corp');
        expect(result.content.body).toContain('Jane Smith');
        expect(result.content.body).toContain('You have been added to');
        expect(result.content.body).not.toContain('has added you');
        expect(result.content.body).toContain('member');
    });

    it('should build email without dashboard URL', () => {
        const result = buildMemberAddedEmail({
            organizationName: 'Acme Corp',
            inviterName: 'John Doe',
            memberName: 'Jane Smith',
            role: 'viewer',
        });

        expect(result.content.body).not.toContain('Access Dashboard');
        expect(result.content.body).toContain('viewer');
    });

    it('should escape HTML in input values', () => {
        const result = buildMemberAddedEmail({
            organizationName: '<script>alert("xss")</script>',
            inviterName: '<b>John</b>',
            memberName: 'Jane & Co',
            role: 'admin',
        });

        expect(result.content.body).not.toContain('<script>');
        expect(result.content.body).toContain('&lt;script&gt;');
        expect(result.content.body).not.toContain('<b>John</b>');
        expect(result.content.body).toContain('&lt;b&gt;John&lt;/b&gt;');
        expect(result.content.body).toContain('Jane &amp; Co');
    });
});

describe('buildMemberRemovedEmail', () => {
    it('should build email with all fields', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane Smith',
            role: 'admin',
            reason: 'left_company',
            contactEmail: 'support@example.com',
        });

        expect(result.subject).toBe('Access removed from Acme Corp');
        expect(result.template).toBe('minimalist');
        expect(result.content.body).toContain('Jane Smith');
        expect(result.content.body).toContain('Acme Corp');
        expect(result.content.body).toContain('admin');
        expect(result.content.body).toContain('Left the company');
        expect(result.content.footer).toContain('support@example.com');
    });

    it('should build email without reason', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane Smith',
            role: 'member',
        });

        expect(result.subject).toBe('Access removed from Acme Corp');
        expect(result.content.body).toContain('Jane Smith');
        expect(result.content.body).not.toContain('Reason:');
        expect(result.content.body).toContain('member');
    });

    it('should map reason codes to labels', () => {
        const reasons = [
            { code: 'left_company', label: 'Left the company' },
            { code: 'role_change', label: 'Role change' },
            { code: 'contract_ended', label: 'Contract ended' },
            { code: 'security_concern', label: 'Security concern' },
            { code: 'duplicate_account', label: 'Duplicate account' },
            { code: 'other', label: 'Other reason' },
        ];

        reasons.forEach(({ code, label }) => {
            const result = buildMemberRemovedEmail({
                organizationName: 'Acme Corp',
                memberName: 'Jane Smith',
                role: 'member',
                reason: code,
            });

            expect(result.content.body).toContain(label);
        });
    });

    it('should not show unknown reason codes', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane Smith',
            role: 'member',
            reason: 'unknown_reason_code',
        });

        expect(result.content.body).not.toContain('Reason:');
        expect(result.content.body).not.toContain('unknown_reason_code');
    });

    it('should build email without contact email', () => {
        const result = buildMemberRemovedEmail({
            organizationName: 'Acme Corp',
            memberName: 'Jane Smith',
            role: 'viewer',
        });

        expect(result.content.footer).toContain('This notification is for your records');
        expect(result.content.footer).not.toContain('mailto:');
    });

    it('should escape HTML in input values', () => {
        const result = buildMemberRemovedEmail({
            organizationName: '<script>alert("xss")</script>',
            memberName: 'Jane & Co',
            role: 'admin',
            contactEmail: 'test@example.com',
        });

        expect(result.content.body).not.toContain('<script>');
        expect(result.content.body).toContain('&lt;script&gt;');
        expect(result.content.body).toContain('Jane &amp; Co');
    });
});
