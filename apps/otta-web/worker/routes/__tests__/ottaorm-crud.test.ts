import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOttaormCrud } from '../ottaorm-crud';

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    hashPassword: vi.fn(async (value: string) => `hashed-${value}`),
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: vi.fn(() => ({})),
}));

vi.mock('@ottabase/ottaorm', () => ({
    parseCrudRequest: vi.fn(),
    executeSecureCrudRequest: vi.fn(),
    registerConnection: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: vi.fn(() => ({})),
    getSecurityContext: vi.fn(() => ({ organizationId: 'org-1', appId: 'otta-web' })),
    invalidateMembershipCache: vi.fn(),
}));

vi.mock('@ottabase/ottablog', () => ({
    Post: { find: vi.fn() },
}));

vi.mock('@ottabase/comments', () => ({
    Comment: { find: vi.fn() },
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    OrganizationMember: { create: vi.fn() },
    User: { whereIn: vi.fn() },
    UserGroupMember: { find: vi.fn() },
}));

function createContext() {
    const request = new Request('https://example.com/api/ottaorm/posts/post-1', { method: 'PATCH' });
    return {
        request,
        env: { OBCF_D1: {} },
        url: new URL(request.url),
    } as any;
}

describe('handleOttaormCrud (posts concurrency)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 409 when expectedUpdatedAt does not match', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Post } = await import('@ottabase/ottablog');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { expectedUpdatedAt: 1000 },
        });
        (Post.find as any).mockResolvedValue({
            get: (key: string) => (key === 'updatedAt' ? 2000 : null),
        });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(409);
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('removes expectedUpdatedAt before executing the update', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Post } = await import('@ottabase/ottablog');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { expectedUpdatedAt: 1000, title: 'Next title' },
        });
        (Post.find as any).mockResolvedValue({
            get: (key: string) => (key === 'updatedAt' ? 1000 : null),
        });
        (executeSecureCrudRequest as any).mockResolvedValue({
            success: true,
            data: { id: 'post-1' },
            status: 200,
        });

        const response = await handleOttaormCrud(createContext());
        const call = (executeSecureCrudRequest as any).mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(call.body.expectedUpdatedAt).toBeUndefined();
    });

    it('blocks organization_members CRUD and requires admin endpoints', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'organization_members',
            method: 'PATCH',
            id: 'user-2',
            body: { role: 'member' },
        });

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(403);
        expect(body.code).toBe('CRUD_DISABLED');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('invalidates membership caches for the acting user and target on group-member POST', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { getSecurityContext, invalidateMembershipCache } = await import('../../lib/auth-utils');

        (getSecurityContext as any).mockResolvedValueOnce({
            userId: 'user-9',
            organizationId: 'org-1',
            appId: 'otta-web',
        });
        (parseCrudRequest as any).mockResolvedValue({
            model: 'user_group_members',
            method: 'POST',
            body: { userId: 'user-2', groupId: 'group-1' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'ugm-1' }, status: 201 });

        const response = await handleOttaormCrud(createContext());
        expect(response.status).toBe(201);

        const invalidatedFor = (invalidateMembershipCache as any).mock.calls.map((c: any[]) => c[1]);
        expect(invalidatedFor).toContain('user-2'); // target member
        expect(invalidatedFor).toContain('user-9'); // acting user (created-groups set)
    });

    it('resolves the affected user from the row before an id-based group-member DELETE', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { invalidateMembershipCache } = await import('../../lib/auth-utils');
        const { UserGroupMember } = await import('@ottabase/ottaorm/models');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'user_group_members',
            method: 'DELETE',
            id: 'ugm-7',
        });
        (UserGroupMember.find as any).mockResolvedValue({
            get: (key: string) => (key === 'userId' ? 'user-5' : null),
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { deleted: true }, status: 200 });

        const response = await handleOttaormCrud(createContext());
        expect(response.status).toBe(200);

        // The row's owner is captured BEFORE the delete removes it.
        expect(UserGroupMember.find as any).toHaveBeenCalledWith('ugm-7');
        const invalidatedFor = (invalidateMembershipCache as any).mock.calls.map((c: any[]) => c[1]);
        expect(invalidatedFor).toContain('user-5');
    });
});
