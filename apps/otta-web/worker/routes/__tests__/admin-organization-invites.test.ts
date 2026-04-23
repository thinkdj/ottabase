import { Organization, OrganizationInvite, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    handleAdminOrganizationInviteCreate,
    handleAdminOrganizationInviteResend,
} from '../admin-organization-invites';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
    resolveCurrentOrgForAdmin: vi.fn(async () => 'org-1'),
    resolveTenantOrganizationId: vi.fn(() => 'org-1'),
    canAccessOrganization: vi.fn(() => true),
    SYSTEM_ORGANIZATION_ID: 'system',
}));

vi.mock('@ottabase/email', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@ottabase/email')>();
    return {
        ...actual,
        sendTemplatedEmail: vi.fn(),
    };
});

vi.mock('../../../src/email/templates', () => ({
    registerAppEmailTemplates: vi.fn(),
}));

vi.mock('../../lib/org-audit', () => ({
    auditOrganizationAction: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    resolveMailer: vi.fn(async () => ({ mailer: {}, from: 'noreply@test' })),
}));

vi.mock('../../lib/org-invite-token', () => ({
    generateOrgInviteRawToken: vi.fn(() => 'new-raw-token'),
    hashOrgInviteToken: vi.fn(async () => 'new-hash'),
}));

import { sendTemplatedEmail } from '@ottabase/email';
import { requireAdminAccess } from '../../lib/admin-guard';

describe('handleAdminOrganizationInviteCreate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1', email: 'admin@test', name: 'Admin' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(Organization, 'find').mockResolvedValue({
            get: (k: string) => (k === 'name' ? 'Org' : null),
        } as any);
        vi.spyOn(User, 'first').mockResolvedValue(null);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue(null);
        vi.spyOn(OrganizationInvite, 'expirePendingPast').mockResolvedValue(0);
    });

    it('deletes the new invite row when email send fails, leaving prior invites intact', async () => {
        const deleteSpy = vi.spyOn(OrganizationInvite, 'deleteById').mockResolvedValue(undefined);
        const revokeSpy = vi.spyOn(OrganizationInvite, 'revokePendingForEmail').mockResolvedValue(undefined);
        const revokeExceptSpy = vi
            .spyOn(OrganizationInvite, 'revokePendingForEmailExcept')
            .mockResolvedValue(undefined);
        vi.spyOn(OrganizationInvite, 'insertInvite').mockResolvedValue({
            id: 'inv-1',
            organizationId: 'org-1',
            email: 'x@test.com',
            role: 'member',
            status: 'pending',
            expiresAt: Date.now() + 999,
        } as any);
        vi.mocked(sendTemplatedEmail).mockRejectedValue(new Error('smtp down'));

        const response = await handleAdminOrganizationInviteCreate(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/invites', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ email: 'x@test.com', role: 'member' }),
                }),
                env: { OBCF_D1: {} },
            } as any,
            'org-1',
        );

        expect(response.status).toBe(500);
        // Prior invites must NOT be revoked when the send fails — they remain valid
        // so the invitee can still use their existing link.
        expect(revokeExceptSpy).not.toHaveBeenCalled();
        expect(deleteSpy).toHaveBeenCalledWith('inv-1');
        expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('revokes prior pending invites AFTER a successful send', async () => {
        vi.spyOn(OrganizationInvite, 'deleteById').mockResolvedValue(undefined);
        const revokeExceptSpy = vi
            .spyOn(OrganizationInvite, 'revokePendingForEmailExcept')
            .mockResolvedValue(undefined);
        vi.spyOn(OrganizationInvite, 'insertInvite').mockResolvedValue({
            id: 'inv-2',
            organizationId: 'org-1',
            email: 'y@test.com',
            role: 'member',
            status: 'pending',
            expiresAt: Date.now() + 999,
        } as any);

        let sendCalledBeforeRevoke = false;
        vi.mocked(sendTemplatedEmail).mockImplementation(async () => {
            sendCalledBeforeRevoke = true;
        });
        revokeExceptSpy.mockImplementation(async () => {
            // Revocation must occur after the send — verify ordering
            if (!sendCalledBeforeRevoke) {
                throw new Error('revoke was called before send');
            }
        });

        const response = await handleAdminOrganizationInviteCreate(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/invites', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ email: 'y@test.com', role: 'member' }),
                }),
                env: { OBCF_D1: {} },
            } as any,
            'org-1',
        );

        expect(response.status).toBe(201);
        expect(revokeExceptSpy).toHaveBeenCalledWith('org-1', 'y@test.com', 'inv-2');
        expect(sendCalledBeforeRevoke).toBe(true);
    });

    it('accepts viewer role when creating an email invite', async () => {
        vi.spyOn(OrganizationInvite, 'deleteById').mockResolvedValue(undefined);
        vi.spyOn(OrganizationInvite, 'revokePendingForEmailExcept').mockResolvedValue(undefined);
        vi.spyOn(OrganizationInvite, 'insertInvite').mockResolvedValue({
            id: 'inv-viewer',
            organizationId: 'org-1',
            email: 'viewer@test.com',
            role: 'viewer',
            status: 'pending',
            expiresAt: Date.now() + 999,
        } as any);
        vi.mocked(sendTemplatedEmail).mockResolvedValue(undefined as any);

        const response = await handleAdminOrganizationInviteCreate(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/invites', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ email: 'viewer@test.com', role: 'viewer' }),
                }),
                env: { OBCF_D1: {} },
            } as any,
            'org-1',
        );

        expect(response.status).toBe(201);
    });
});

function inviteRow(overrides: Record<string, any> = {}) {
    return {
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'user@test.com',
        role: 'member',
        status: 'pending',
        tokenHash: 'old-hash',
        invitedAt: Date.now() - 1000,
        expiresAt: Date.now() + 10_000,
        invitedBy: 'admin-1',
        metadata: null,
        ...overrides,
    };
}

describe('handleAdminOrganizationInviteResend (H4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1', email: 'admin@test', name: 'Admin' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(Organization, 'find').mockResolvedValue({
            get: (k: string) => (k === 'name' ? 'Org' : null),
        } as any);
    });

    it('returns 500 and logs ORG_INVITE_RESEND_ROLLBACK_FAILED when both send and rollback fail', async () => {
        vi.spyOn(OrganizationInvite, 'listForOrganization').mockResolvedValue([inviteRow()] as any);
        vi.spyOn(OrganizationInvite, 'updateById')
            // First call: rotate token — succeeds
            .mockResolvedValueOnce(inviteRow({ tokenHash: 'new-hash' }) as any)
            // Second call (rollback): fails
            .mockRejectedValueOnce(new Error('db down'));
        vi.mocked(sendTemplatedEmail).mockRejectedValue(new Error('smtp down'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const response = await handleAdminOrganizationInviteResend(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/invites/inv-1/resend', {
                    method: 'POST',
                }),
                env: {} as any,
                url: new URL('http://localhost/api/admin/organizations/org-1/invites/inv-1/resend'),
            } as any,
            'org-1',
            'inv-1',
        );

        expect(response.status).toBe(500);
        const body = (await response.json()) as any;
        expect(body.code).toBe('ORG_INVITE_EMAIL_FAILED');
        // Operator-visible structured log must be emitted
        expect(consoleSpy).toHaveBeenCalledWith(
            'ORG_INVITE_RESEND_ROLLBACK_FAILED',
            expect.objectContaining({
                inviteId: 'inv-1',
                organizationId: 'org-1',
            }),
        );
        consoleSpy.mockRestore();
    });

    it('returns 500 with rollback applied when send fails but rollback succeeds', async () => {
        vi.spyOn(OrganizationInvite, 'listForOrganization').mockResolvedValue([inviteRow()] as any);
        const updateSpy = vi
            .spyOn(OrganizationInvite, 'updateById')
            .mockResolvedValueOnce(inviteRow({ tokenHash: 'new-hash' }) as any)
            .mockResolvedValueOnce(inviteRow() as any); // rollback succeeds
        vi.mocked(sendTemplatedEmail).mockRejectedValue(new Error('smtp down'));

        const response = await handleAdminOrganizationInviteResend(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/invites/inv-1/resend', {
                    method: 'POST',
                }),
                env: {} as any,
                url: new URL('http://localhost/api/admin/organizations/org-1/invites/inv-1/resend'),
            } as any,
            'org-1',
            'inv-1',
        );

        expect(response.status).toBe(500);
        // Rollback should have restored the old tokenHash
        expect(updateSpy).toHaveBeenCalledTimes(2);
    });
});
