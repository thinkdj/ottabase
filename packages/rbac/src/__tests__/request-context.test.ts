import { beforeEach, describe, expect, it, vi } from 'vitest';

const systemRoles = vi.hoisted(() => ({ value: [] as string[] }));

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}));
vi.mock('@ottabase/ottaorm/models', () => ({
    User: { find: vi.fn(async () => ({ id: 'user-1' })) },
    OrganizationMember: { isMember: vi.fn(async () => false) },
}));
vi.mock('../utils', () => ({
    createRBACContext: vi.fn(async (_user: unknown, _cache: unknown, opts: { organizationId: string }) =>
        opts.organizationId === 'system'
            ? { roles: systemRoles.value, permissions: [], isAuthenticated: true }
            : { roles: [], permissions: [], isAuthenticated: true },
    ),
}));

import { getRequestContext } from '../request-context';

const requestAsSystem = () => new Request('http://localhost/api/x', { headers: { 'x-org-id': 'system' } });

describe('getRequestContext — system scope', () => {
    beforeEach(() => {
        systemRoles.value = [];
    });

    it('does not grant system scope to a caller who merely asks for it', async () => {
        const ctx = await getRequestContext(requestAsSystem(), {});
        expect(ctx.organizationId).toBeNull();
        expect(ctx.isSystemScope).toBe(false);
    });

    it('grants system scope to a holder of a system-scoped role', async () => {
        systemRoles.value = ['platform_owner'];
        const ctx = await getRequestContext(requestAsSystem(), {});
        expect(ctx.organizationId).toBe('system');
        expect(ctx.isSystemScope).toBe(true);
    });

    it('drops a requested tenant org the caller is not a member of', async () => {
        const request = new Request('http://localhost/api/x', { headers: { 'x-org-id': 'org-other' } });
        const ctx = await getRequestContext(request, {});
        expect(ctx.organizationId).toBeNull();
    });
});
