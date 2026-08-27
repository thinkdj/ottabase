import { OrganizationMember, User, type OrganizationMemberType } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    handleAdminOrganizationInviteMember,
    handleAdminOrganizationMembersList,
    handleAdminOrganizationRemoveMember,
    handleAdminOrganizationUpdateMember,
} from '../admin-organization-members';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
    SYSTEM_ORGANIZATION_ID: 'system',
}));

import { requireAdminAccess } from '../../lib/admin-guard';

function rosterMember(overrides: Partial<OrganizationMemberType> = {}): OrganizationMemberType {
    return {
        id: 'membership-1',
        userId: 'user-2',
        invitedEmail: null,
        organizationId: 'org-1',
        role: 'member',
        status: 'active',
        invitedBy: null,
        invitedAt: null,
        joinedAt: null,
        metadata: null,
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

describe('handleAdminOrganizationInviteMember', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Roster access requires an OWNER/ADMIN membership in the target org; the happy paths below
        // act on org-1, of which the caller is an owner/admin.
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(true);
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
        const createSpy = vi.spyOn(OrganizationMember, 'create').mockResolvedValue({
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
        expect(createSpy).toHaveBeenCalledWith(
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
        vi.spyOn(OrganizationMember, 'findExistingInvite').mockResolvedValue({ id: 'existing-member' } as any);

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

    it.each(['active', 'suspended'] as const)(
        'rejects an email-only invite with %s status instead of creating a phantom membership',
        async (status) => {
            vi.mocked(requireAdminAccess).mockResolvedValue({
                user: { id: 'admin-1' },
                organizationId: 'org-1',
                appId: 'web',
                rbac: { organizationId: 'org-1' } as any,
                session: {},
            });
            vi.spyOn(User, 'findByEmail').mockResolvedValue(null);
            const createSpy = vi.spyOn(OrganizationMember, 'create');

            const response = await handleAdminOrganizationInviteMember(
                {
                    request: new Request('http://localhost/api/admin/organizations/org-1/members/invite', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ email: 'new@example.com', role: 'member', status }),
                    }),
                    env: {},
                } as any,
                'org-1',
            );

            expect(response.status).toBe(400);
            expect(createSpy).not.toHaveBeenCalled();
            expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
        },
    );

    it('updates role and status for an existing member', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(OrganizationMember, 'first').mockResolvedValueOnce({
            toJson: () => ({ role: 'member', status: 'invited' }),
        } as any);
        const updateSpy = vi.spyOn(OrganizationMember, 'updateRosterMembership').mockResolvedValue({
            status: 'updated',
            member: rosterMember({ role: 'admin' }),
        });

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
        expect(updateSpy).toHaveBeenCalledWith(
            'user-2',
            'org-1',
            { role: 'admin', status: 'active' },
            { role: 'member', status: 'invited' },
        );
    });

    it('prevents changing role or status of the last active owner', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'owner', status: 'active' }),
        } as any);
        vi.spyOn(OrganizationMember, 'hasRole').mockResolvedValue(true);
        const updateSpy = vi
            .spyOn(OrganizationMember, 'updateRosterMembership')
            .mockResolvedValue({ status: 'last_active_owner' });

        const response = await handleAdminOrganizationUpdateMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ role: 'admin' }),
                }),
                env: {},
            } as any,
            'org-1',
            'user-2',
        );

        expect(response.status).toBe(409);
        expect(updateSpy).toHaveBeenCalledOnce();
        const body = (await response.json()) as any;
        expect(body.code).toBe('LAST_ACTIVE_OWNER_GUARD');
    });

    it('returns MEMBERSHIP_CHANGED when the atomic update detects a stale snapshot', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'member', status: 'active' }),
        } as any);
        vi.spyOn(OrganizationMember, 'updateRosterMembership').mockResolvedValue({ status: 'stale' });

        const response = await handleAdminOrganizationUpdateMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ status: 'suspended' }),
                }),
                env: {},
            } as any,
            'org-1',
            'user-2',
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: 'MEMBERSHIP_CHANGED' });
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

        vi.spyOn(OrganizationMember, 'first').mockResolvedValueOnce({
            toJson: () => ({ role: 'member', status: 'active' }),
        } as any);
        const removeSpy = vi
            .spyOn(OrganizationMember, 'removeRosterMembership')
            .mockResolvedValue({ status: 'removed' });

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
        expect(removeSpy).toHaveBeenCalledWith('user-2', 'org-1', { role: 'member', status: 'active' });
        expect(await response.json()).toEqual({
            data: { userId: 'user-2', organizationId: 'org-1', removed: true },
        });
    });

    it('prevents removing the last active owner', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });

        vi.spyOn(OrganizationMember, 'first').mockResolvedValueOnce({
            toJson: () => ({ role: 'owner', status: 'active' }),
        } as any);
        vi.spyOn(OrganizationMember, 'hasRole').mockResolvedValue(true);
        const removeSpy = vi
            .spyOn(OrganizationMember, 'removeRosterMembership')
            .mockResolvedValue({ status: 'last_active_owner' });

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
        expect(removeSpy).toHaveBeenCalledOnce();
        const body = (await response.json()) as any;
        expect(body.code).toBe('LAST_ACTIVE_OWNER_GUARD');
    });

    it('returns MEMBERSHIP_CHANGED when the atomic removal detects a stale snapshot', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'member', status: 'active' }),
        } as any);
        vi.spyOn(OrganizationMember, 'removeRosterMembership').mockResolvedValue({ status: 'stale' });

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
        expect(await response.json()).toMatchObject({ code: 'MEMBERSHIP_CHANGED' });
    });
});

describe('roster access boundary (owner/admin membership in the TARGET org)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const systemAuth = {
        user: { id: 'platform-owner-1' },
        organizationId: 'system',
        appId: 'web',
        rbac: { organizationId: 'system' } as any,
        session: {},
    };

    it('denies a system-scope admin who is not an owner/admin of the target org', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(systemAuth);
        const spy = vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(false);

        const response = await handleAdminOrganizationMembersList(
            {
                request: new Request('http://localhost/api/admin/organizations/org-9/members'),
                env: {},
            } as any,
            'org-9',
        );

        expect(response.status).toBe(403);
        expect(spy).toHaveBeenCalledWith('platform-owner-1', 'org-9');
    });

    it('denies a rank-and-file member self-promoting to owner in the target org', async () => {
        // Regression for the roster-escalation report: the attacker passes requireAdminAccess via
        // org:admin in their OWN personal org (auth.organizationId here), and is a plain 'member' of
        // the target org-9. assertRosterAccess must require OWNER/ADMIN in org-9 — a plain member
        // (isOwnerOrAdmin=false) is rejected, so they can never PATCH their own role to 'owner'.
        vi.mocked(requireAdminAccess).mockResolvedValue({
            ...systemAuth,
            user: { id: 'attacker' },
            organizationId: 'attacker-personal-org',
        });
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(false);
        const updateSpy = vi.spyOn(OrganizationMember, 'updateRosterMembership');

        const response = await handleAdminOrganizationUpdateMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-9/members/attacker', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ role: 'owner' }),
                }),
                env: {},
            } as any,
            'org-9',
            'attacker',
        );

        expect(response.status).toBe(403);
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('denies even when the target org is injected via header/query', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ ...systemAuth, organizationId: 'org-9' });
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(false);

        const response = await handleAdminOrganizationInviteMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-9/members/invite', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ userId: 'victim', role: 'admin' }),
                }),
                env: {},
            } as any,
            'org-9',
        );

        expect(response.status).toBe(403);
    });

    it('allows an owner/admin of the target org', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(systemAuth);
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(true);
        vi.spyOn(OrganizationMember, 'countOrganizationMembers').mockResolvedValue(0);
        vi.spyOn(OrganizationMember, 'getOrganizationMembers').mockResolvedValue([]);

        const response = await handleAdminOrganizationMembersList(
            {
                request: new Request('http://localhost/api/admin/organizations/org-9/members'),
                env: {},
            } as any,
            'org-9',
        );

        expect(response.status).toBe(200);
    });

    it('denies an ADMIN self-promoting to owner (only owners may grant owner)', async () => {
        // The admin passes assertRosterAccess (isOwnerOrAdmin) but is NOT an owner (hasRole → false).
        vi.mocked(requireAdminAccess).mockResolvedValue({ ...systemAuth, user: { id: 'org-admin' } });
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(true);
        vi.spyOn(OrganizationMember, 'hasRole').mockResolvedValue(false);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ userId: 'org-admin', organizationId: 'org-9', role: 'admin' }),
        } as any);
        const updateSpy = vi.spyOn(OrganizationMember, 'updateRosterMembership');

        const response = await handleAdminOrganizationUpdateMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-9/members/org-admin', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ role: 'owner' }),
                }),
                env: {},
            } as any,
            'org-9',
            'org-admin',
        );

        expect(response.status).toBe(403);
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('denies an ADMIN removing an owner', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ ...systemAuth, user: { id: 'org-admin' } });
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(true);
        vi.spyOn(OrganizationMember, 'hasRole').mockResolvedValue(false);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ userId: 'the-owner', organizationId: 'org-9', role: 'owner' }),
        } as any);
        const removeSpy = vi.spyOn(OrganizationMember, 'removeRosterMembership');

        const response = await handleAdminOrganizationRemoveMember(
            {
                request: new Request('http://localhost/api/admin/organizations/org-9/members/the-owner', {
                    method: 'DELETE',
                }),
                env: {},
            } as any,
            'org-9',
            'the-owner',
        );

        expect(response.status).toBe(403);
        expect(removeSpy).not.toHaveBeenCalled();
    });
});

describe('atomic roster and org-scoped grant mutations', () => {
    function patchRequest(role: string) {
        return {
            request: new Request('http://localhost/api/admin/organizations/org-1/members/user-2', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ role }),
            }),
            env: {},
        } as any;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(OrganizationMember, 'isOwnerOrAdmin').mockResolvedValue(true);
        // Caller is an OWNER, so the owner-tier hierarchy guard admits demoting an owner.
        vi.spyOn(OrganizationMember, 'hasRole').mockResolvedValue(true);
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
    });

    it('delegates demotion and grant revocation to one atomic model mutation', async () => {
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'owner', status: 'active' }),
        } as any);
        const updateSpy = vi.spyOn(OrganizationMember, 'updateRosterMembership').mockResolvedValue({
            status: 'updated',
            member: rosterMember(),
        });

        const response = await handleAdminOrganizationUpdateMember(patchRequest('member'), 'org-1', 'user-2');

        expect(response.status).toBe(200);
        expect(updateSpy).toHaveBeenCalledWith(
            'user-2',
            'org-1',
            { role: 'member' },
            { role: 'owner', status: 'active' },
        );
    });

    it('delegates promotion without a separate route-level grant operation', async () => {
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'member', status: 'active' }),
        } as any);
        const updateSpy = vi.spyOn(OrganizationMember, 'updateRosterMembership').mockResolvedValue({
            status: 'updated',
            member: rosterMember({ role: 'admin' }),
        });

        const response = await handleAdminOrganizationUpdateMember(patchRequest('admin'), 'org-1', 'user-2');

        expect(response.status).toBe(200);
        expect(updateSpy).toHaveBeenCalledOnce();
    });

    it('delegates member removal and grant revocation to one atomic model mutation', async () => {
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'member', status: 'active' }),
        } as any);
        const removeSpy = vi
            .spyOn(OrganizationMember, 'removeRosterMembership')
            .mockResolvedValue({ status: 'removed' });

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
        expect(removeSpy).toHaveBeenCalledWith('user-2', 'org-1', { role: 'member', status: 'active' });
    });

    it('returns a generic update failure when the atomic model mutation rejects', async () => {
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'owner', status: 'active' }),
        } as any);
        vi.spyOn(OrganizationMember, 'updateRosterMembership').mockRejectedValue(
            new Error('authorization: Bearer raw-secret-token'),
        );
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const response = await handleAdminOrganizationUpdateMember(patchRequest('member'), 'org-1', 'user-2');
        const body = (await response.json()) as any;

        expect(response.status).toBe(500);
        expect(body.code).toBe('ORG_MEMBER_UPDATE_FAILED');
        expect(JSON.stringify(body)).not.toContain('raw-secret-token');
        expect(JSON.stringify(logSpy.mock.calls)).not.toContain('raw-secret-token');
        logSpy.mockRestore();
    });

    it('returns a generic removal failure when the atomic model mutation rejects', async () => {
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            toJson: () => ({ role: 'member', status: 'active' }),
        } as any);
        vi.spyOn(OrganizationMember, 'removeRosterMembership').mockRejectedValue(new Error('token=raw-secret-token'));
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

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
        const body = (await response.json()) as any;

        expect(response.status).toBe(500);
        expect(body.code).toBe('ORG_MEMBER_REMOVE_FAILED');
        expect(JSON.stringify(body)).not.toContain('raw-secret-token');
        expect(JSON.stringify(logSpy.mock.calls)).not.toContain('raw-secret-token');
        logSpy.mockRestore();
    });
});
