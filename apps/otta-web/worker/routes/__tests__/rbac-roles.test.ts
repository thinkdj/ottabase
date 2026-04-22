import { Role } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
    resolveTenantOrganizationId: vi.fn(),
    canAccessOrganization: vi.fn(),
}));

vi.mock('../admin-roles', () => ({
    invalidateRBACCache: vi.fn(),
}));

import { canAccessOrganization, requireAdminAccess, resolveTenantOrganizationId } from '../../lib/admin-guard';
import { invalidateRBACCache } from '../admin-roles';
import {
    handleRBACRoleCreate,
    handleRBACRoleDelete,
    handleRBACRoleGet,
    handleRBACRoleUpdate,
    handleRBACRolesList,
} from '../rbac-roles';

function adminContext(orgId = 'org-1') {
    return {
        user: { id: 'admin-1' },
        organizationId: orgId,
        appId: 'web',
        rbac: {} as any,
        session: {},
    } as any;
}

function mockRole(overrides: Partial<Record<string, any>> = {}) {
    const attrs: Record<string, any> = {
        id: 'role-1',
        name: 'custom',
        organizationId: 'org-1',
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
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');
        vi.mocked(canAccessOrganization).mockReturnValue(true);
    });

    it('returns 401 when auth fails', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('unauthorized', { status: 401 }));

        const response = await handleRBACRolesList({
            request: new Request('http://localhost/api/rbac/roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(401);
    });

    it('returns system and org custom roles when org context is present', async () => {
        const systemRole = mockRole({ id: 'r-sys', name: 'admin', isSystem: true, organizationId: null });
        const customRole = mockRole({ id: 'r-custom', name: 'editor', organizationId: 'org-1' });
        vi.spyOn(Role, 'findByOrg').mockResolvedValue([systemRole, customRole] as any);

        const response = await handleRBACRolesList({
            request: new Request('http://localhost/api/rbac/roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(Role.findByOrg).toHaveBeenCalledWith('org-1');
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data).toHaveLength(2);
        expect(body.data[0].name).toBe('admin');
        expect(body.data[1].organizationId).toBe('org-1');
    });

    it('returns only system roles when there is no org context (system scope)', async () => {
        vi.mocked(resolveTenantOrganizationId).mockReturnValue(null);
        const systemRole = mockRole({ id: 'r-sys', name: 'owner', isSystem: true, organizationId: null });
        vi.spyOn(Role, 'where').mockResolvedValue([systemRole] as any);

        const response = await handleRBACRolesList({
            request: new Request('http://localhost/api/rbac/roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe('owner');
    });

    it('returns 500 when the database read fails', async () => {
        vi.spyOn(Role, 'findByOrg').mockRejectedValue(new Error('boom'));

        const response = await handleRBACRolesList({
            request: new Request('http://localhost/api/rbac/roles'),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(500);
        const body = (await response.json()) as any;
        expect(body.code).toBe('ROLES_LIST_FAILED');
    });
});

describe('handleRBACRoleCreate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');
        vi.mocked(canAccessOrganization).mockReturnValue(true);
    });

    it('forwards the auth guard response when unauthorized', async () => {
        const forbidden = new Response('forbidden', { status: 403 });
        vi.mocked(requireAdminAccess).mockResolvedValue(forbidden);

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { name: 'new' }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'either' });
        expect(response).toBe(forbidden);
    });

    it('returns 400 when there is no org context', async () => {
        vi.mocked(resolveTenantOrganizationId).mockReturnValue(null);

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { name: 'editor' }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('ORG_CONTEXT_REQUIRED');
    });

    it('returns 400 when name is missing', async () => {
        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { permissions: [] }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when request body is invalid JSON', async () => {
        const response = await handleRBACRoleCreate({
            request: new Request('http://localhost/api/rbac/roles', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{',
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('BAD_REQUEST');
    });

    it('returns 409 when name shadows a reserved system role name', async () => {
        for (const reserved of ['owner', 'admin', 'member', 'viewer']) {
            vi.clearAllMocks();
            vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
            vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');

            const response = await handleRBACRoleCreate({
                request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { name: reserved }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles'),
            });

            expect(response.status).toBe(409);
            const body = (await response.json()) as any;
            expect(body.code).toBe('CONFLICT');
        }
    });

    it('returns 409 when a role with the same name already exists in the org', async () => {
        vi.spyOn(Role, 'first').mockResolvedValue(mockRole({ name: 'editor' }) as any);

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', { name: 'editor' }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('CONFLICT');
    });

    it('creates an org-scoped role and invalidates the RBAC cache', async () => {
        vi.spyOn(Role, 'first').mockResolvedValue(null as any);
        const createSpy = vi.spyOn(Role, 'create').mockResolvedValue(
            mockRole({
                id: 'r-new',
                name: 'editor',
                organizationId: 'org-1',
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
            organizationId: 'org-1',
            description: 'Editor role',
            permissions: JSON.stringify(['blog:*']),
            isSystem: false,
        });
        expect(invalidateRBACCache).toHaveBeenCalled();
        expect(response.status).toBe(201);
        const body = (await response.json()) as any;
        expect(body.data.name).toBe('editor');
        expect(body.data.organizationId).toBe('org-1');
        expect(body.data.permissions).toEqual(['blog:*']);
    });
});

describe('handleRBACRoleUpdate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');
        vi.mocked(canAccessOrganization).mockReturnValue(true);
    });

    it('returns 404 when role is not found', async () => {
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

    it('returns 400 when update body is invalid JSON', async () => {
        vi.spyOn(Role, 'find').mockResolvedValue(mockRole({ organizationId: 'org-1' }) as any);

        const response = await handleRBACRoleUpdate(
            {
                request: new Request('http://localhost/api/rbac/roles/r-editor', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: '{',
                }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('BAD_REQUEST');
    });

    it('rejects attempts to modify a system role with 403', async () => {
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

    it('returns 403 when the role belongs to a different org', async () => {
        vi.spyOn(Role, 'find').mockResolvedValue(mockRole({ organizationId: 'org-other' }) as any);
        vi.mocked(canAccessOrganization).mockReturnValue(false);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-other', 'PATCH', {
                    description: 'hijack',
                }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-other'),
            },
            'r-other',
        );

        expect(response.status).toBe(403);
        expect(invalidateRBACCache).not.toHaveBeenCalled();
    });

    it('updates description and permissions on an org-scoped custom role', async () => {
        const role = mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1' });
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
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');
        vi.mocked(canAccessOrganization).mockReturnValue(true);
    });

    it('rejects deletion of a system role with 403', async () => {
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

    it('returns 403 when the role belongs to a different org', async () => {
        const role = mockRole({ id: 'r-other', organizationId: 'org-other' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);
        vi.mocked(canAccessOrganization).mockReturnValue(false);

        const response = await handleRBACRoleDelete(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-other', 'DELETE'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-other'),
            },
            'r-other',
        );

        expect(response.status).toBe(403);
        expect(role.destroy).not.toHaveBeenCalled();
        expect(invalidateRBACCache).not.toHaveBeenCalled();
    });

    it('deletes an org-scoped custom role and invalidates the RBAC cache', async () => {
        const role = mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1' });
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

describe('handleRBACRoleCreate — permission format validation (M2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');
        vi.spyOn(Role, 'first').mockResolvedValue(null as any);
    });

    it('returns 400 when a permission string has no colon separator', async () => {
        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', {
                name: 'editor',
                permissions: ['nocolon'],
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when an empty string permission is supplied', async () => {
        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', {
                name: 'editor',
                permissions: [''],
            }),
            env: {} as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('accepts wildcard permissions like "blog:*"', async () => {
        vi.spyOn(Role, 'create').mockResolvedValue(
            mockRole({ id: 'r-new', name: 'editor', permissions: '["blog:*"]' }) as any,
        );

        const response = await handleRBACRoleCreate({
            request: jsonRequest('http://localhost/api/rbac/roles', 'POST', {
                name: 'editor',
                permissions: ['blog:*'],
            }),
            env: { OBCF_KV: {} } as any,
            url: new URL('http://localhost/api/rbac/roles'),
        });

        expect(response.status).toBe(201);
    });
});

describe('handleRBACRoleUpdate — rename support (M1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');
        vi.mocked(canAccessOrganization).mockReturnValue(true);
    });

    it('renames a custom role to a valid new name', async () => {
        const role = mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);
        vi.spyOn(Role, 'first').mockResolvedValue(null as any);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'PATCH', {
                    name: 'content-editor',
                }),
                env: { OBCF_KV: {} } as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(role.set).toHaveBeenCalledWith('name', 'content-editor');
        expect(role.save).toHaveBeenCalled();
        expect(response.status).toBe(200);
    });

    it('returns 409 when renaming to a reserved system role name', async () => {
        const role = mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'PATCH', { name: 'admin' }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('CONFLICT');
    });

    it('returns 409 when renaming to a name already used by another role in the org', async () => {
        const role = mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1' });
        const otherRole = mockRole({ id: 'r-other', name: 'designer', organizationId: 'org-1' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);
        vi.spyOn(Role, 'first').mockResolvedValue(otherRole as any);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'PATCH', { name: 'designer' }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('CONFLICT');
    });

    it('returns 400 when updating permissions with invalid format', async () => {
        const role = mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1' });
        vi.spyOn(Role, 'find').mockResolvedValue(role);

        const response = await handleRBACRoleUpdate(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'PATCH', {
                    permissions: ['invalid-no-colon'],
                }),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.code).toBe('VALIDATION_ERROR');
    });
});

describe('handleRBACRoleGet (L4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue(adminContext());
        vi.mocked(canAccessOrganization).mockReturnValue(true);
    });

    it('returns 401 when auth fails', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('unauthorized', { status: 401 }));

        const response = await handleRBACRoleGet(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-1', 'GET'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-1'),
            },
            'r-1',
        );

        expect(response.status).toBe(401);
    });

    it('returns 404 when the role does not exist', async () => {
        vi.spyOn(Role, 'find').mockResolvedValue(null as any);

        const response = await handleRBACRoleGet(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/missing', 'GET'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/missing'),
            },
            'missing',
        );

        expect(response.status).toBe(404);
    });

    it('returns 404 when the role belongs to a different org', async () => {
        vi.spyOn(Role, 'find').mockResolvedValue(mockRole({ id: 'r-1', organizationId: 'org-other' }) as any);
        vi.mocked(canAccessOrganization).mockReturnValue(false);

        const response = await handleRBACRoleGet(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-1', 'GET'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-1'),
            },
            'r-1',
        );

        expect(response.status).toBe(404);
    });

    it('returns the role when found and accessible', async () => {
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-editor', name: 'editor', organizationId: 'org-1', permissions: '["blog:read"]' }) as any,
        );

        const response = await handleRBACRoleGet(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-editor', 'GET'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-editor'),
            },
            'r-editor',
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data.id).toBe('r-editor');
        expect(body.data.permissions).toEqual(['blog:read']);
    });

    it('returns a system role (organizationId=null) without org access check', async () => {
        vi.spyOn(Role, 'find').mockResolvedValue(
            mockRole({ id: 'r-admin', name: 'admin', organizationId: null, isSystem: true }) as any,
        );

        const response = await handleRBACRoleGet(
            {
                request: jsonRequest('http://localhost/api/rbac/roles/r-admin', 'GET'),
                env: {} as any,
                url: new URL('http://localhost/api/rbac/roles/r-admin'),
            },
            'r-admin',
        );

        expect(response.status).toBe(200);
        expect(canAccessOrganization).not.toHaveBeenCalled();
    });
});
