import { Role, User, UserRole } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', async () => {
    const actual = await vi.importActual<typeof import('../../lib/admin-guard')>('../../lib/admin-guard');
    return {
        ...actual,
        requireAdminAccess: vi.fn(),
    };
});

vi.mock('@ottabase/rbac', () => ({
    getRBACCache: () => ({ invalidateUser: vi.fn() }),
}));

vi.mock('../admin-roles', () => ({
    invalidateRBACCache: vi.fn(),
}));

import { requireAdminAccess } from '../../lib/admin-guard';
import { invalidateRBACCache } from '../admin-roles';
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

    it('allows assigning a system role across organizations', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
        // System role (isSystem=true, organizationId=null) must be assignable in any org
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-member', name: 'member', isSystem: true, organizationId: null }),
        );
        vi.spyOn(UserRole, 'first').mockResolvedValue(
            mockUserRole({ userId: 'user-1', roleId: 'r-member', organizationId: 'org-1' }) as any,
        );

        const response = await handleRBACUserRoleAssign({
            request: jsonRequest('http://localhost/api/rbac/user-roles', 'POST', {
                userId: 'user-1',
                roleId: 'r-member',
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/user-roles'),
        });

        expect(response.status).toBe(201);
    });

    it('allows assigning a custom role that belongs to the same organization', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
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

    it('assigns the role, invalidates the RBAC cache, and returns the assignment', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext('org-1'));
        const assignRole = vi.fn();
        vi.spyOn(User, 'find').mockResolvedValue({ assignRole } as any);
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
        expect(response.status).toBe(201);
        const body = (await response.json()) as any;
        expect(body.data.roleName).toBe('editor');
    });
});

describe('handleRBACUserRoleRemove', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.success).toBe(true);
    });
});
