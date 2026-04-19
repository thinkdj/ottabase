import { Organization, OrganizationInvite, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdminOrganizationInviteCreate } from '../admin-organization-invites';

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

    it('deletes the new invite row when email send fails (does not revoke prior invites first)', async () => {
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
        expect(deleteSpy).toHaveBeenCalledWith('inv-1');
        expect(revokeSpy).not.toHaveBeenCalled();
        expect(revokeExceptSpy).not.toHaveBeenCalled();
    });

    it('revokes duplicate pendings only after a successful send', async () => {
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
        vi.mocked(sendTemplatedEmail).mockResolvedValue(undefined as any);

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
    });
});
