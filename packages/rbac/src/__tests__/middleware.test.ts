import { describe, expect, it, vi } from 'vitest';
import { checkPermission, withRBAC } from '../middleware';

function mockUser(permissionsByOrg: Record<string, string[]>) {
    return {
        get: (key: string) => (key === 'id' ? 'user-1' : null),
        roles: vi.fn(async ({ organizationId }: { organizationId: string }) =>
            (permissionsByOrg[organizationId] ? ['member'] : []).map((name) => ({ get: () => name })),
        ),
        getPermissions: vi.fn(
            async ({ organizationId }: { organizationId: string }) => permissionsByOrg[organizationId] ?? [],
        ),
    } as any;
}

const ok = vi.fn(async (_request: Request) => new Response('ok'));

describe('withRBAC', () => {
    it('returns 401 when no getUserFromRequest is configured, never trusts an x-user-id header', async () => {
        const handler = withRBAC(ok, { permissions: 'users:read' } as any);
        const res = await handler(new Request('http://x/', { headers: { 'x-user-id': 'user-1' } }));
        expect(res.status).toBe(401);
        expect(ok).not.toHaveBeenCalled();
    });

    it('evaluates grants only in the organization from getOrganizationId', async () => {
        // The user is an admin in org-a, a plain member elsewhere.
        const user = mockUser({ 'org-a': ['users:read'], 'org-b': [] });
        const forOrg = (org: string) =>
            withRBAC(ok, {
                permissions: 'users:read',
                getUserFromRequest: async () => user,
                getOrganizationId: () => org,
            });

        expect((await forOrg('org-a')(new Request('http://x/'))).status).toBe(200);
        expect((await forOrg('org-b')(new Request('http://x/'))).status).toBe(403);
        expect(user.getPermissions).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-b' }));
    });

    it('denies (403) when no organization resolves, instead of merging every org', async () => {
        const user = mockUser({ 'org-a': ['users:read'] });
        const handler = withRBAC(ok, {
            permissions: 'users:read',
            getUserFromRequest: async () => user,
            getOrganizationId: () => null,
        });
        const res = await handler(new Request('http://x/'));
        expect(res.status).toBe(403);
        expect(user.getPermissions).not.toHaveBeenCalled();
    });
});

describe('checkPermission', () => {
    it('passes options.organizationId through to the grant lookup', async () => {
        const user = mockUser({ 'org-a': ['posts:read'] });
        await expect(checkPermission(user, 'posts:read', { organizationId: 'org-a' })).resolves.toBeUndefined();
        await expect(checkPermission(user, 'posts:read', { organizationId: 'org-b' })).rejects.toThrow();
        await expect(checkPermission(user, 'posts:read')).rejects.toThrow();
    });
});
