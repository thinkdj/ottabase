import { Role } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
}));

vi.mock('../admin-roles', () => ({
    invalidateRBACCache: vi.fn(),
}));

import { requireAdminAccess } from '../../lib/admin-guard';
import { invalidateRBACCache } from '../admin-roles';
import { handleRBACRoleCreate, handleRBACRoleDelete, handleRBACRoleUpdate, handleRBACRolesList } from '../rbac-roles';

function adminContext() {
    return {
        user: { id: 'admin-1' },
        organizationId: 'org-1',
        appId: 'web',
        rbac: {} as any,
        session: {},
    } as any;
}

function mockRole(overrides: Partial<Record<string, any>> = {}) {
    const attrs: Record<string, any> = {
        id: 'role-1',
        name: 'custom',
        description: null,
        permissions: '[]',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
    return {
        get: (key: string) => attrs[key],
        set: vi.fn((key: string, value: any) => {
            attrs[key] = value;
        }),
        save: vi.fn(async () => {}),
        destroy: vi.fn(async () => {}),
        getPermissions: () => {
            try {
                return JSON.parse(attrs.permissions);
            } catch {
                return [];
            }
        },
    } as any;
}

function jsonRequest(url: string, method: string, body?: unknown) {
    return new Request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe('handleRBACRolesList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns roles ordered by name without requiring auth', async () => {
        const allSpy = vi
            .spyOn(Role, 'all')
            .mockResolvedValue([
                mockRole({ id: 'r1', name: 'admin' }),
                mockRole({ id: 'r2', name: 'owner', permissions: '["*:*"]' }),
            ] as any);

        const response = await handleRBACRolesList({
            request: new Request('http://localhost/api/rbac/roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(allSpy).toHaveBeenCalledWith({ orderBy: 'name', orderDirection: 'asc' });
        expect(requireAdminAccess).not.toHaveBeenCalled();
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data).toHaveLength(2);
        expect(body.data[0].name).toBe('admin');
        expect(body.data[1].permissions).toEqual(['*:*']);
    });

    it('returns 500 when the database read fails', async () => {
        vi.spyOn(Role, 'all').mockRejectedValue(new Error('boom'));

        const response = await handleRBACRolesList({
            request: new Request('http://localhost/api/rbac/roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(500);
    });
});

describe('handleRBACRoleCreate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards the auth guard response when unauthorized', async () => {
        const forbidden = new Response('forbidden', { status: 403 });
        vi.mocked(requireAdminAccess).mockResolvedValue(forbidden);

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { name: 'new' }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'system' });
        expect(response).toBe(forbidden);
    });

    it('returns 400 when name is missing', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { permissions: [] }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 when role name already exists', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(Role, 'first').mockResolvedValue(mockRole({ name: 'existing' }));

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { name: 'existing' }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('CONFLICT');
    });

    it('creates a non-system role and invalidates the RBAC cache', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(Role, 'first').mockResolvedValue(null as any);
        const createSpy = vi.spyOn(Role, 'create').mockResolvedValue(
            mockRole({
                id: 'r-new',
                name: 'editor',
                description: 'Editor role',
                permissions: '["blog:*"]',
            }) as any,
        );

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', {
                name: '  Editor ',
                description: 'Editor role',
                permissions: ['blog:*'],
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(createSpy).toHaveBeenCalledWith({
            name: 'editor',
            description: 'Editor role',
            permissions: JSON.stringify(['blog:*']),
            isSystem: false,
        });
        expect(invalidateRBACCache).toHaveBeenCalled();
        expect(response.status).toBe(201);
        const body = (await response.json()) as any;
        expect(body.data.name).toBe('editor');
        expect(body.data.permissions).toEqual(['blog:*']);
    });
});

describe('handleRBACRoleUpdate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 404 when role is not found', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(Role, 'find').mockResolvedValue(null as any);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/missing', 'PATCH', {}),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/missing'),
            },
            'missing',
        );

        expect(response.status).toBe(404);
    });

    it('rejects attempts to modify a system role with 403', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.spyOn(Role, 'find').mockResolvedValue(mockRole({ isSystem: true, name: 'owner' }) as any);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/role-owner', 'PATCH', {
                    description: 'nope',
                }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/role-owner'),
            },
            'role-owner',
        );

        expect(response.status).toBe(403);
        expect(invalidateRBACCache).not.toHaveBeenCalled();
    });

    it('updates description and permissions on a non-system role', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        const role = mockRole({ id: 'r-editor', name: 'editor' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'PATCH', {
                    description: 'Editors',
                    permissions: ['blog:read', 'blog:create'],
                }),
                env: { OBCF_KV: {} } as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(role.set).toHaveBeenCalledWith('description', 'Editors');
        expect(role.set).toHaveBeenCalledWith('permissions', JSON.stringify(['blog:read', 'blog:create']));
        expect(role.save).toHaveBeenCalled();
        expect(invalidateRBACCache).toHaveBeenCalled();
        expect(response.status).toBe(200);
    });
});

describe('handleRBACRoleDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects deletion of a system role with 403', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        const role = mockRole({ isSystem: true, name: 'owner' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);

        const response = await handleRBACRoleDelete(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/role-owner', 'DELETE'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/role-owner'),
            },
            'role-owner',
        );

        expect(response.status).toBe(403);
        expect(role.destroy).not.toHaveBeenCalled();
        expect(invalidateRBACCache).not.toHaveBeenCalled();
    });

    it('deletes a custom role and invalidates the RBAC cache', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        const role = mockRole({ id: 'r-editor', name: 'editor' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);

        const response = await handleRBACRoleDelete(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'DELETE'),
                env: { OBCF_KV: {} } as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(role.destroy).toHaveBeenCalled();
        expect(invalidateRBACCache).toHaveBeenCalled();
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.success).toBe(true);
    });
});
