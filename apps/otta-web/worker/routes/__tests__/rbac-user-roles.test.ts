import { OrganizationMember, Role, User, UserRole } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
    canAccessOrganization: vi.fn((auth: any, organizationId: string) => auth.organizationId === organizationId),
}));

vi.mock('@ottabase/rbac', () => ({
    getRBACCache: () => ({ invalidateUser: vi.fn() }),
}));

vi.mock('../admin-roles', () => ({
    invalidateRBACCache: vi.fn(),
}));

vi.mock('../../lib/rate-limiting', () => ({
    enforceRateLimit: vi.fn(async () => null),
}));

vi.mock('../../lib/org-audit', () => ({
    auditOrganizationAction: vi.fn(),
}));

import { canAccessOrganization, requireAdminAccess } from '../../lib/admin-guard';
import { enforceRateLimit } from '../../lib/rate-limiting';
import { invalidateRBACCache } from '../admin-roles';
import { auditOrganizationAction } from '../../lib/org-audit';
import { handleRBACUserRoleAssign, handleRBACUserRoleRemove, handleRBACUserRolesList } from '../rbac-user-roles';

function adminContext(orgId = 'org-1') {
    return {
        user: { id: 'admin-1' },
        organizationId: orgId,
        appId: 'web',
        rbac: {} as any,
        session: {},
    } as any;
}

function mockRole(overrides: Record<string, any> = {}) {
    const attrs = {
        id: 'role-editor',
        name: 'editor',
        description: 'Can edit',
        permissions: '[]',
        isSystem: false,
        ...overrides,
    };
    return {
        get: (key: string) => (attrs as any)[key],
    } as any;
}

function mockUserRole(overrides: Record<string, any> = {}) {
    const attrs = {
        userId: 'user-1',
        roleId: 'role-editor',
        organizationId: 'org-1',
        appId: null,
        assignedAt: '2026-01-01',
        assignedBy: 'admin-1',
        ...overrides,
    };
    return {
        get: (key: string) => (attrs as any)[key],
        role: async () => mockRole({ id: attrs.roleId, name: attrs.roleId.replace('role-', '') }),
        assigner: async () => ({ get: () => 'Admin User' }),
    } as any;
}

function jsonRequest(url: string, method: string, body?: unknown) {
    return new Request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe('handleRBACUserRolesList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(canAccessOrganization).mockImplementation((auth: any, organizationId: string) => {
            return auth.organizationId === organizationId;
        });
    });

    it('returns 400 when userId is missing', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());

        const response = await handleRBACUserRolesList({
            request: new Request('http://localhost/api/rbac/user-roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('uses caller organization when organizationId is not in the query', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-my'));
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ userId: 'user-1', organizationId: 'org-my' } as any);
        vi.spyOn(Role, 'whereIn').mockResolvedValue([
            mockRole({ id: 'role-editor', name: 'editor', isSystem: false }),
        ] as any);
        vi.spyOn(User, 'whereIn').mockResolvedValue([] as any);
        const getSpy = vi
            .spyOn(UserRole, 'getUserRoles')
            .mockResolvedValue([mockUserRole({ organizationId: 'org-my' })] as any);

        const response = await handleRBACUserRolesList({
            request: new Request('http://localhost/api/rbac/user-roles?userId=user-1'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles?userId=user-1'),
        });

        expect(getSpy).toHaveBeenCalledWith('user-1', 'org-my');
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data[0]).toMatchObject({ userId: 'user-1', roleId: 'role-editor', roleName: 'editor' });
    });

    it('returns 404 when the target user is not an active organization member', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-my'));
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue(null as any);

        const response = await handleRBACUserRolesList({
            request: new Request('http://localhost/api/rbac/user-roles?userId=user-1'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles?userId=user-1'),
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as any;
        expect(body.code).toBe('MEMBER_NOT_FOUND');
    });

    it('returns only custom assignments (filters system roles)', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-my'));
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ userId: 'user-1', organizationId: 'org-my' } as any);
        vi.spyOn(Role, 'whereIn').mockResolvedValue([
            mockRole({ id: 'role-owner', name: 'owner', isSystem: true, organizationId: null }),
            mockRole({ id: 'role-editor', name: 'editor', isSystem: false, organizationId: 'org-my' }),
        ] as any);
        vi.spyOn(User, 'whereIn').mockResolvedValue([] as any);
        vi.spyOn(UserRole, 'getUserRoles').mockResolvedValue([
            {
                ...mockUserRole({ roleId: 'role-owner' }),
                role: async () => mockRole({ id: 'role-owner', name: 'owner', isSystem: true, organizationId: null }),
            },
            {
                ...mockUserRole({ roleId: 'role-editor' }),
                role: async () =>
                    mockRole({ id: 'role-editor', name: 'editor', isSystem: false, organizationId: 'org-my' }),
            },
        ] as any);

        const response = await handleRBACUserRolesList({
            request: new Request('http://localhost/api/rbac/user-roles?userId=user-1'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles?userId=user-1'),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data).toHaveLength(1);
        expect(body.data[0].roleName).toBe('editor');
    });

    it('returns 403 when the caller cannot access the requested org', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-a'));

        const response = await handleRBACUserRolesList({
            request: new Request('http://localhost/api/rbac/user-roles?userId=user-1&organizationId=org-other'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles?userId=user-1&organizationId=org-other'),
        });

        expect(response.status).toBe(403);
    });
});

describe('handleRBACUserRoleAssign', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(canAccessOrganization).mockImplementation((auth: any, organizationId: string) => {
            return auth.organizationId === organizationId;
        });
    });

    it('forwards the auth guard response when unauthorized', async () => {
        const forbidden = new Response('forbidden', { status: 403 });
        vi.mocked(requireAdminAccess).mockResolvedValue(forbidden);

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {}),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response).toBe(forbidden);
    });

    it('returns 400 when userId or roleId is missing', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', { userId: 'user-1' }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when the user does not exist', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(User, 'find').mockResolvedValue(null as any);
        vi.spyOn(Role, 'find').mockResolvedValue(mockRole());

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'missing',
                roleId: 'role-editor',
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as any;
        expect(body.code).toBe('USER_NOT_FOUND');
    });

    it('returns 404 when the role does not exist', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole: vi.fn() } as any);
        vi.spyOn(Role, 'find').mockResolvedValue(null as any);

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'missing',
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as any;
        expect(body.code).toBe('ROLE_NOT_FOUND');
    });

    it('returns 404 when the role belongs to a different organization (cross-tenant guard)', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole: vi.fn() } as any);
        // Role exists but belongs to a different org — must not be assignable cross-tenant
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-foreign', name: 'analyst', isSystem: false, organizationId: 'org-other' }),
        );

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'r-foreign',
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as any;
        expect(body.code).toBe('ROLE_NOT_FOUND');
    });

    it('rejects assigning system roles via custom user-role endpoint', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
        // System role (isSystem=true, organizationId=null) must be assignable in any org
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-member', name: 'member', isSystem: true, organizationId: null }),
        );

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'r-member',
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(assignRole).not.toHaveBeenCalled();
        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('SYSTEM_ROLE_ASSIGNMENT_FORBIDDEN');
    });

    it('allows assigning a custom role that belongs to the same organization', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ userId: 'user-1', organizationId: 'org-1' } as any);
        // Custom role scoped to the caller's own org — must be assignable
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-editor', name: 'editor', isSystem: false, organizationId: 'org-1' }),
        );
        vi.spyOn(UserRole, 'first').mockResolvedValue(
            mockUserRole({ userId: 'user-1', roleId: 'r-editor', organizationId: 'org-1' }) as any,
        );

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'r-editor',
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(201);
    });

    it('returns 403 when assigning a custom role to a non-member user', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-editor', name: 'editor', isSystem: false, organizationId: 'org-1' }),
        );
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue(null as any);

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'r-editor',
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(assignRole).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
        const body = (await response.json()) as any;
        expect(body.code).toBe('FORBIDDEN');
    });

    it('assigns the role, invalidates the RBAC cache, and returns the assignment', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ userId: 'user-1', organizationId: 'org-1' } as any);
        // Role must belong to the caller's org (organizationId matches) to pass the cross-tenant guard.
        vi.spyOn(Role, 'find').mockResolvedValue(mockRole({ organizationId: 'org-1' }));
        vi.spyOn(UserRole, 'first').mockResolvedValue(
            mockUserRole({ userId: 'user-1', roleId: 'role-editor', organizationId: 'org-1' }) as any,
        );

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'role-editor',
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(assignRole).toHaveBeenCalledWith('role-editor', 'admin-1', 'org-1', expect.any(Object));
        expect(invalidateRBACCache).toHaveBeenCalled();
        // Audit must be called with a Request and the canonical shape — not context.env
        expect(auditOrganizationAction).toHaveBeenCalledTimes(1);
        const [auditReq, auditOpts] = vi.mocked(auditOrganizationAction).mock.calls[0]!;
        expect(auditReq).toBeInstanceOf(Request);
        expect(auditOpts).toMatchObject({
            userId: 'admin-1',
            organizationId: 'org-1',
            action: 'RBAC_ROLE_ASSIGNED',
            resourceType: 'user_role',
            resourceId: 'user-1',
            metadata: { roleId: 'role-editor', roleName: 'editor' },
        });
        expect(response.status).toBe(201);
        const body = (await response.json()) as any;
        expect(body.data.roleName).toBe('editor');
    });

    it('uses the target organizationId in the assign rate-limit key', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('system'));
        vi.mocked(canAccessOrganization).mockReturnValue(true);
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'role-editor', name: 'editor', isSystem: false, organizationId: 'org-1' }),
        );
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ userId: 'user-1', organizationId: 'org-1' } as any);
        vi.spyOn(UserRole, 'first').mockResolvedValue(
            mockUserRole({ userId: 'user-1', roleId: 'role-editor', organizationId: 'org-1' }) as any,
        );

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'role-editor',
                organizationId: 'org-1',
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(201);
        expect(enforceRateLimit).toHaveBeenCalledWith(
            expect.any(Request),
            expect.anything(),
            'rbac:role-assign:org-1',
            {
                limit: 10,
                period: 60,
            },
        );
    });
});

describe('handleRBACUserRoleRemove', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(canAccessOrganization).mockImplementation((auth: any, organizationId: string) => {
            return auth.organizationId === organizationId;
        });
    });

    it('returns 404 when the user does not exist', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(User, 'find').mockResolvedValue(null as any);

        const response = await handleRBACUserRoleRemove(
            {
                request: jsonRequest('http://localhost/api/rbac/user-roles/missing/role-editor', 'DELETE'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/user-roles/missing/role-editor'),
            },
            'missing',
            'role-editor',
        );

        expect(response.status).toBe(404);
    });

    it('removes the role assignment and invalidates the RBAC cache', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const removeRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ removeRole } as any);
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'role-editor', name: 'editor', isSystem: false, organizationId: 'org-1' }),
        );
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({ userId: 'user-1', organizationId: 'org-1' } as any);

        const response = await handleRBACUserRoleRemove(
            {
                request: jsonRequest('http://localhost/api/rbac/user-roles/user-1/role-editor', 'DELETE'),
                env: { OBCF_KV: {} } as any,
                url: new URL('http://localhost/api/rbac/user-roles/user-1/role-editor'),
            },
            'user-1',
            'role-editor',
        );

        expect(removeRole).toHaveBeenCalledWith('role-editor', 'org-1', expect.any(Object));
        expect(invalidateRBACCache).toHaveBeenCalled();
        // Audit must be called with a Request and the canonical shape — not context.env
        expect(auditOrganizationAction).toHaveBeenCalledTimes(1);
        const [auditReq, auditOpts] = vi.mocked(auditOrganizationAction).mock.calls[0]!;
        expect(auditReq).toBeInstanceOf(Request);
        expect(auditOpts).toMatchObject({
            userId: 'admin-1',
            organizationId: 'org-1',
            action: 'RBAC_ROLE_REMOVED',
            resourceType: 'user_role',
            resourceId: 'user-1',
            metadata: { roleId: 'role-editor', roleName: 'editor' },
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.success).toBe(true);
    });

    it('returns 409 when trying to remove a system role via custom user-role endpoint', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const removeRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ removeRole } as any);
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'role-member', name: 'member', isSystem: true, organizationId: null }),
        );

        const response = await handleRBACUserRoleRemove(
            {
                request: jsonRequest('http://localhost/api/rbac/user-roles/user-1/role-member', 'DELETE'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/user-roles/user-1/role-member'),
            },
            'user-1',
            'role-member',
        );

        expect(removeRole).not.toHaveBeenCalled();
        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('SYSTEM_ROLE_ASSIGNMENT_FORBIDDEN');
    });

    it('uses the target organizationId in the remove rate-limit key', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('system'));
        vi.mocked(canAccessOrganization).mockReturnValue(true);
        const removeRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ removeRole } as any);
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'role-editor', name: 'editor', isSystem: false, organizationId: 'org-target' }),
        );
        vi.spyOn(OrganizationMember, 'first').mockResolvedValue({
            userId: 'user-1',
            organizationId: 'org-target',
            status: 'active',
        } as any);

        const response = await handleRBACUserRoleRemove(
            {
                request: jsonRequest(
                    'http://localhost/api/rbac/user-roles/user-1/role-editor?organizationId=org-target',
                    'DELETE',
                ),
                env: { OBCF_KV: {} } as any,
                url: new URL('http://localhost/api/rbac/user-roles/user-1/role-editor?organizationId=org-target'),
            },
            'user-1',
            'role-editor',
        );

        expect(response.status).toBe(200);
        expect(enforceRateLimit).toHaveBeenCalledWith(
            expect.any(Request),
            expect.anything(),
            'rbac:role-remove:org-target',
            {
                limit: 10,
                period: 60,
            },
        );
    });
});
