import { MembershipError, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    handleAdminOrganizationInviteMember,
    handleAdminOrganizationMembersList,
    handleAdminOrganizationRemoveMember,
    handleAdminOrganizationUpdateMember,
} from '../admin-organization-members';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
    resolveCurrentOrgForAdmin: vi.fn(async () => 'org-1'),
    resolveTenantOrganizationId: vi.fn(() => 'org-1'),
    canAccessOrganization: vi.fn(() => true),
    SYSTEM_ORGANIZATION_ID: 'system',
}));

vi.mock('../../lib/org-audit', () => ({
    auditOrganizationAction: vi.fn(),
}));

import { requireAdminAccess } from '../../lib/admin-guard';

describe('handleAdminOrganizationInviteMember', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates the membership with server-controlled invite fields', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(User, 'find').mockResolvedValue({ toJson: () => ({ id: 'user-2' }) } as any);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue(null);
        const addMemberSpy = vi.spyOn(OrganizationMember, 'addMember').mockResolvedValue({
            toJson: () => ({ userId: 'user-2', organizationId: 'org-1', role: 'member', status: 'invited' }),
        } as any);

        const response = await handleAdminOrganizationInviteMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/invite', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ userId: 'user-2', role: 'member', status: 'invited' }),
                }),
                env: {},
            } as any,
            'org-1',
        );

        expect(response.status).toBe(201);
        expect(addMemberSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-2',
                organizationId: 'org-1',
                role: 'member',
                status: 'invited',
                invitedBy: 'admin-1',
                invitedAt: expect.any(Number),
            }),
        );
    });

    it('rejects duplicate memberships', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(User, 'find').mockResolvedValue({ toJson: () => ({ id: 'user-2' }) } as any);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ toJson: () => ({}) } as any);

        const response = await handleAdminOrganizationInviteMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/invite', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ userId: 'user-2', role: 'member', status: 'invited' }),
                }),
                env: {},
            } as any,
            'org-1',
        );

        expect(response.status).toBe(409);
    });

    it('updates role and status for an existing member via setRole / setStatus', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(OrganizationMember, 'first')
            .mockResolvedValueOnce({ toJson: () => ({ role: 'member', status: 'invited' }) } as any)
            .mockResolvedValueOnce({
                toJson: () => ({ userId: 'user-2', organizationId: 'org-1', role: 'admin', status: 'active' }),
            } as any);

        const setRoleSpy = vi.spyOn(OrganizationMember, 'setRole').mockResolvedValue(undefined as any);
        const setStatusSpy = vi.spyOn(OrganizationMember, 'setStatus').mockResolvedValue(undefined as any);

        const response = await handleAdminOrganizationUpdateMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ role: 'admin', status: 'active' }),
                }),
                env: {},
            } as any,
            'org-1',
            'user-2',
        );

        expect(response.status).toBe(200);
        expect(setRoleSpy).toHaveBeenCalledWith(
            'user-2',
            'org-1',
            'admin',
            expect.objectContaining({ assignedBy: 'admin-1' }),
        );
        expect(setStatusSpy).toHaveBeenCalledWith(
            'user-2',
            'org-1',
            'active',
            expect.objectContaining({ assignedBy: 'admin-1' }),
        );
    });

    it('maps LAST_ACTIVE_OWNER_GUARD from setRole to a 409', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ toJson: () => ({}) } as any);
        vi.spyOn(OrganizationMember, 'setRole').mockRejectedValue(
            new MembershipError('LAST_ACTIVE_OWNER_GUARD', 'demoting only owner'),
        );

        const response = await handleAdminOrganizationUpdateMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ role: 'member' }),
                }),
                env: {},
            } as any,
            'org-1',
            'user-2',
        );

        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('LAST_ACTIVE_OWNER_GUARD');
    });

    it('lists members with joined user details', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });

        vi.spyOn(OrganizationMember, 'countOrganizationMembers').mockResolvedValue(1);
        vi.spyOn(OrganizationMember, 'countActiveOwners').mockResolvedValue(2);
        vi.spyOn(OrganizationMember, 'getOrganizationMembers').mockResolvedValue([
            {
                userId: 'user-2',
                organizationId: 'org-1',
                role: 'member',
                status: 'active',
                invitedAt: null,
                joinedAt: Date.now(),
                user: {
                    id: 'user-2',
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    image: null,
                },
            } as any,
        ]);

        const response = await handleAdminOrganizationMembersList(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members'),
                env: {},
            } as any,
            'org-1',
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data).toEqual([
            {
                id: 'user-2-org-1',
                userId: 'user-2',
                organizationId: 'org-1',
                role: 'member',
                status: 'active',
                invitedAt: null,
                joinedAt: expect.any(Number),
                isLastActiveOwner: false,
                user: {
                    id: 'user-2',
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    image: null,
                },
            },
        ]);
        expect(body.pagination).toMatchObject({ page: 1, total: 1, perPage: 25 });
    });

    it('removes an existing member', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });

        vi.spyOn(OrganizationMember, 'first').mockResolvedValueOnce({ toJson: () => ({}) } as any);
        const removeSpy = vi.spyOn(OrganizationMember, 'removeMember').mockResolvedValue(true);

        const response = await handleAdminOrganizationRemoveMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                    method: 'DELETE',
                }),
                env: {},
            } as any,
            'org-1',
            'user-2',
        );

        expect(response.status).toBe(200);
        expect(removeSpy).toHaveBeenCalledWith('user-2', 'org-1', expect.any(Object));
        expect(await response.json()).toEqual({
            data: { userId: 'user-2', organizationId: 'org-1', removed: true },
        });
    });

    it('maps LAST_ACTIVE_OWNER_GUARD from removeMember to a 409', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });

        vi.spyOn(OrganizationMember, 'first').mockResolvedValueOnce({ toJson: () => ({}) } as any);
        vi.spyOn(OrganizationMember, 'removeMember').mockRejectedValue(
            new MembershipError('LAST_ACTIVE_OWNER_GUARD', 'cannot remove last owner'),
        );

        const response = await handleAdminOrganizationRemoveMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                    method: 'DELETE',
                }),
                env: {},
            } as any,
            'org-1',
            'user-2',
        );

        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('LAST_ACTIVE_OWNER_GUARD');
    });
});
