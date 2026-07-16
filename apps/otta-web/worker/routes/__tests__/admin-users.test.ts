import { OrganizationMember, User } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdminUserById, handleAdminUserSearch } from '../admin-users';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
}));

import { requireAdminAccess } from '../../lib/admin-guard';

describe('handleAdminUserSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns an empty list for short queries without hitting the database', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: {} as any,
            session: {},
        });
        const searchSpy = vi.spyOn(User, 'search');

        const response = await handleAdminUserSearch({
            request: new Request('http://localhost/api/admin/users/search?q=a&organizationId=org-1'),
            env: {},
        } as any);

        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'either' });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: [] });
        expect(searchSpy).not.toHaveBeenCalled();

        searchSpy.mockRestore();
    });

    it('returns an empty list for org admins when query is not an email', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: {} as any,
            session: {},
        });
        const searchSpy = vi.spyOn(User, 'search');

        const response = await handleAdminUserSearch({
            request: new Request('http://localhost/api/admin/users/search?q=ada&limit=5&organizationId=org-1'),
            env: {},
        } as any);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: [] });
        expect(searchSpy).not.toHaveBeenCalled();

        searchSpy.mockRestore();
    });

    it('allows org admins to lookup exact email only', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: {} as any,
            session: {},
        });
        const searchSpy = vi.spyOn(User, 'search').mockResolvedValue([
            {
                toJson: () => ({
                    id: 'user_123',
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    image: 'https://example.com/ada.png',
                    createdAt: Date.now(),
                }),
            } as any,
        ]);

        const response = await handleAdminUserSearch({
            request: new Request(
                'http://localhost/api/admin/users/search?q=ada@example.com&limit=5&organizationId=org-1',
            ),
            env: {},
        } as any);

        expect(searchSpy).toHaveBeenCalledWith('ada@example.com', ['email'], undefined, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit: 5,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: [
                {
                    id: 'user_123',
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    image: 'https://example.com/ada.png',
                },
            ],
        });

        searchSpy.mockRestore();
    });

    it('allows system admins to use broad search by name, email, or id', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1' },
            organizationId: 'system',
            appId: 'web',
            rbac: {} as any,
            session: {},
        });
        const searchSpy = vi.spyOn(User, 'search').mockResolvedValue([] as any);

        const response = await handleAdminUserSearch({
            request: new Request('http://localhost/api/admin/users/search?q=ada&limit=5'),
            env: {},
        } as any);

        expect(searchSpy).toHaveBeenCalledWith('ada', ['name', 'email', 'id'], undefined, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit: 5,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: [] });

        searchSpy.mockRestore();
    });

    it('returns the auth failure response when admin access is denied', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('Forbidden', { status: 403 }));

        const response = await handleAdminUserSearch({
            request: new Request('http://localhost/api/admin/users/search?q=ada'),
            env: {},
        } as any);

        expect(response.status).toBe(403);
    });
});

describe('handleAdminUserById', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exposes only memberships for organizations the caller also belongs to', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'platform-owner-1' },
            organizationId: 'system',
            appId: 'web',
            rbac: {} as any,
            session: {},
        });
        vi.spyOn(User, 'find').mockResolvedValue({ toJson: () => ({ id: 'target-user', email: 't@e.com' }) } as any);
        // Caller shares only org-shared with the target; org-secret must be filtered out.
        vi.spyOn(OrganizationMember, 'organizationIdsForUser').mockResolvedValue(['org-shared']);
        vi.spyOn(OrganizationMember, 'where').mockResolvedValue([
            { toJson: () => ({ userId: 'target-user', organizationId: 'org-shared', role: 'member' }) },
            { toJson: () => ({ userId: 'target-user', organizationId: 'org-secret', role: 'owner' }) },
        ] as any);

        const response = await handleAdminUserById(
            { request: new Request('http://localhost/api/admin/users/target-user'), env: {} } as any,
            'target-user',
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data.memberships).toEqual([
            { userId: 'target-user', organizationId: 'org-shared', role: 'member' },
        ]);
    });

    it('returns no memberships when the caller shares no organization with the target', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'platform-owner-1' },
            organizationId: 'system',
            appId: 'web',
            rbac: {} as any,
            session: {},
        });
        vi.spyOn(User, 'find').mockResolvedValue({ toJson: () => ({ id: 'target-user' }) } as any);
        vi.spyOn(OrganizationMember, 'organizationIdsForUser').mockResolvedValue([]);
        vi.spyOn(OrganizationMember, 'where').mockResolvedValue([
            { toJson: () => ({ userId: 'target-user', organizationId: 'org-secret', role: 'owner' }) },
        ] as any);

        const response = await handleAdminUserById(
            { request: new Request('http://localhost/api/admin/users/target-user'), env: {} } as any,
            'target-user',
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.data.memberships).toEqual([]);
    });
});
