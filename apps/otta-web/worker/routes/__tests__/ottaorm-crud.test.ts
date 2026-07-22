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
    Comment: { find: vi.fn(), validateReplyParent: vi.fn() },
    CommentReaction: { toggle: vi.fn(), deleteForComment: vi.fn(), reactionsFor: vi.fn() },
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    Organization: { delete: vi.fn() },
    OrganizationMember: { create: vi.fn(), isOwnerOrAdmin: vi.fn() },
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

    it.each(['user_roles', 'roles', 'permissions'])(
        'blocks generic CRUD on the RBAC grant/definition table %s (privilege-escalation guard)',
        async (model) => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

            // Anonymous-style POST that, unblocked, would mint a platform_owner grant on user_roles.
            (parseCrudRequest as any).mockResolvedValue({
                model,
                method: 'POST',
                body: { userId: 'attacker', roleId: 'platform-owner-role-id', organizationId: 'system' },
            });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('CRUD_DISABLED');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        },
    );

    it.each([
        'user_group_members',
        'user_groups',
        'menu_slot_assignments',
        'ottablog_themes',
        'audit_logs',
        'sessions',
    ])(
        'DEFAULT-DENIES generic CRUD for the non-allowlisted model %s (e.g. self-grant group ownership)',
        async (model) => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

            (parseCrudRequest as any).mockResolvedValue({
                model,
                method: 'POST',
                body: { userId: 'attacker', groupId: 'group-1', role: 'owner', status: 'active' },
            });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('CRUD_NOT_ALLOWED');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        },
    );

    it.each(['posts', 'media', 'categories', 'series'])(
        'ALLOWS generic CRUD for the allow-listed app-data model %s',
        async (model) => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            (parseCrudRequest as any).mockResolvedValue({ model, method: 'GET' });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: [], status: 200 });

            const response = await handleOttaormCrud(createContext());
            expect(response.status).toBe(200);
            expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        },
    );
});

describe('handleOttaormCrud (posts null-org authoring guard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a non-platform-admin creating a post with no active org (null-org is platform-owned)', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { getSecurityContext } = await import('../../lib/auth-utils');

        (getSecurityContext as any).mockResolvedValueOnce({ organizationId: null, appId: 'otta-web' });
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'POST',
            body: { title: 'Sneaky draft', slug: 'sneaky-draft', status: 'draft' },
        });

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(403);
        expect(body.code).toBe('FORBIDDEN');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('allows a platform admin to create a null-org (platform-owned) post', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { getSecurityContext } = await import('../../lib/auth-utils');

        (getSecurityContext as any).mockResolvedValueOnce({
            organizationId: null,
            appId: 'otta-web',
            platformAdmin: true,
        });
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'POST',
            body: { title: 'Platform post', slug: 'platform-post', status: 'draft' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'post-1' }, status: 200 });

        const response = await handleOttaormCrud(createContext());
        const call = (executeSecureCrudRequest as any).mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(call.body.organizationId).toBeNull();
    });

    it('stamps the active org unchanged for a normal member (unaffected by the null-org guard)', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'POST',
            body: { title: 'Org post', slug: 'org-post', status: 'draft' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'post-1' }, status: 200 });

        const response = await handleOttaormCrud(createContext());
        const call = (executeSecureCrudRequest as any).mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(call.body.organizationId).toBe('org-1');
    });
});

describe('handleOttaormCrud (organization create — owner-membership atomicity)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('provisions the owner membership after a successful org create (no rollback)', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Organization, OrganizationMember } = await import('@ottabase/ottaorm/models');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'organizations',
            method: 'POST',
            body: { name: 'New Org' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({
            success: true,
            data: { id: 'org-new' },
            status: 201,
        });
        (OrganizationMember.create as any).mockResolvedValue({ id: 'member-1' });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(201);
        expect(OrganizationMember.create as any).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1', organizationId: 'org-new', role: 'owner' }),
        );
        // Success path must NOT roll back the org.
        expect(Organization.delete as any).not.toHaveBeenCalled();
    });

    it('compensating-deletes the orphaned org and returns 500 when the owner-membership insert fails', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Organization, OrganizationMember } = await import('@ottabase/ottaorm/models');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'organizations',
            method: 'POST',
            body: { name: 'New Org' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({
            success: true,
            data: { id: 'org-new' },
            status: 201,
        });
        // D1 has no cross-table txn: the org row is committed, but the membership insert blows up.
        (OrganizationMember.create as any).mockRejectedValue(new Error('membership insert failed'));
        (Organization.delete as any).mockResolvedValue(undefined);

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(500);
        expect(body.code).toBe('ORG_MEMBER_CREATE_FAILED');
        // The just-created org must be rolled back so it isn't orphaned (unreachable via memberships).
        expect(Organization.delete as any).toHaveBeenCalledWith('org-new');
    });

    it('still returns 500 (does not throw) when the compensating delete itself fails', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Organization, OrganizationMember } = await import('@ottabase/ottaorm/models');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'organizations',
            method: 'POST',
            body: { name: 'New Org' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({
            success: true,
            data: { id: 'org-new' },
            status: 201,
        });
        (OrganizationMember.create as any).mockRejectedValue(new Error('membership insert failed'));
        (Organization.delete as any).mockRejectedValue(new Error('rollback failed too'));

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(500);
        expect(body.code).toBe('ORG_MEMBER_CREATE_FAILED');
    });
});

describe('handleOttaormCrud (organization mutation authorization)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    async function orgWrite(method: 'PATCH' | 'PUT' | 'DELETE', ctxOverride: Record<string, unknown>) {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { getSecurityContext } = await import('../../lib/auth-utils');
        (getSecurityContext as any).mockResolvedValueOnce({
            organizationId: 'org-1',
            appId: 'otta-web',
            ...ctxOverride,
        });
        (parseCrudRequest as any).mockResolvedValue({
            model: 'organizations',
            method,
            id: 'org-1',
            body: method === 'DELETE' ? undefined : { name: 'Renamed' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'org-1' }, status: 200 });
        return handleOttaormCrud(createContext());
    }

    // PUT is covered deliberately — secure CRUD treats it as a full update like PATCH, so a guard
    // listing only PATCH/DELETE would leave PUT as a silent bypass.
    it.each(['PATCH', 'PUT', 'DELETE'] as const)(
        'blocks a non-owner member from %sing an organization',
        async (method) => {
            const { executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { OrganizationMember } = await import('@ottabase/ottaorm/models');
            (OrganizationMember.isOwnerOrAdmin as any).mockResolvedValue(false);

            const response = await orgWrite(method, { permissions: [] });
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('FORBIDDEN');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        },
    );

    it.each(['PATCH', 'PUT', 'DELETE'] as const)('allows an owner/admin of the TARGET org to %s it', async (method) => {
        const { executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { OrganizationMember } = await import('@ottabase/ottaorm/models');
        (OrganizationMember.isOwnerOrAdmin as any).mockResolvedValue(true);

        const response = await orgWrite(method, { permissions: [] });

        expect(OrganizationMember.isOwnerOrAdmin as any).toHaveBeenCalledWith('user-1', 'org-1');
        expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        expect(response.status).toBe(200);
    });

    // NOTE: this asserts the ROUTE GUARD skips the membership check for a platform admin. Whether
    // they can actually reach a non-member org is decided by the organizations RLS filter, which is
    // covered separately (and unmocked) in packages/ottaorm rls/__tests__/registry.test.ts.
    it('skips the membership check for a platform admin', async () => {
        const { executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { OrganizationMember } = await import('@ottabase/ottaorm/models');

        const response = await orgWrite('PATCH', { platformAdmin: true, permissions: ['*:*'] });

        expect(OrganizationMember.isOwnerOrAdmin as any).not.toHaveBeenCalled();
        expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        expect(response.status).toBe(200);
    });
});

describe('handleOttaormCrud (comments)', () => {
    function makeCommentStub(data: Record<string, unknown>) {
        return {
            get: (key: string) => data[key],
            toJson: () => data,
            toggleReaction: vi.fn().mockResolvedValue({ added: true }),
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks comment_reactions CRUD entirely', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({ model: 'comment_reactions', method: 'GET' });

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(403);
        expect(body.code).toBe('CRUD_DISABLED');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('blocks hard DELETE of comments', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'DELETE', id: 'c1' });

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(403);
        expect(body.code).toBe('CRUD_DISABLED');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    describe('POST create', () => {
        it('derives organizationId from the target post, not the caller ambient/header org', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce({ organizationId: 'org-CALLER', appId: 'otta-web' });
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'post-1' },
            });
            (Post.find as any).mockResolvedValue({
                get: (key: string) => (key === 'organizationId' ? 'org-POST' : null),
            });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: true, depth: 0 });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'c1' }, status: 201 });

            const response = await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(response.status).toBe(201);
            expect(call[0].body.organizationId).toBe('org-POST');
            expect(call[0].body.userId).toBe('user-1');
            expect(call[1].organizationId).toBe('org-POST');
        });

        it('returns 404 when the target post does not exist', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'missing-post' },
            });
            (Post.find as any).mockResolvedValue(null);

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(404);
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('rejects a parentId that does not belong to the same target/org', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'post-1', parentId: 'other-org-comment' },
            });
            (Post.find as any).mockResolvedValue({ get: () => 'org-1' });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: false });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(400);
            expect(body.code).toBe('VALIDATION_ERROR');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('overwrites a client-supplied depth with the server-computed value', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'reply', targetType: 'post', targetId: 'post-1', parentId: 'parent-1', depth: 999 },
            });
            (Post.find as any).mockResolvedValue({ get: () => 'org-1' });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: true, depth: 2 });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 201 });

            await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(call[0].body.depth).toBe(2);
        });
    });

    describe('PATCH _reaction (toggle)', () => {
        it('requires authentication', async () => {
            const { getSession } = await import('@ottabase/auth/backend');
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (getSession as any).mockResolvedValueOnce({ user: null });
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { _reaction: '👍' },
            });
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({ id: 'c1', targetType: 'post', targetId: 'post-1', organizationId: 'org-1' }),
            );
            (Post.find as any).mockResolvedValue({ get: () => 'org-1' });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(401);
            expect(body.code).toBe('UNAUTHENTICATED');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('returns 404 (not a permission error) when the comment organizationId does not match its own target real org — closes the cross-tenant reaction IDOR', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { _reaction: '👍' },
            });
            // The stored row claims org-EVIL, but the target post's real org is org-REAL.
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({ id: 'c1', targetType: 'post', targetId: 'post-1', organizationId: 'org-EVIL' }),
            );
            (Post.find as any).mockResolvedValue({ get: () => 'org-REAL' });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(404);
            expect(body.code).toBe('NOT_FOUND');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('toggles via CommentReaction (through Comment.toggleReaction) and returns the aggregated reactions map', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment, CommentReaction } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { _reaction: '👍' },
            });
            const stub = makeCommentStub({ id: 'c1', targetType: 'post', targetId: 'post-1', organizationId: 'org-1' });
            (Comment.find as any).mockResolvedValue(stub);
            (Post.find as any).mockResolvedValue({ get: () => 'org-1' });
            (CommentReaction.reactionsFor as any).mockResolvedValue(new Map([['c1', { '👍': ['user-1'] }]]));

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(200);
            expect(stub.toggleReaction).toHaveBeenCalledWith('👍', 'user-1');
            expect(body.reactions).toEqual({ '👍': ['user-1'] });
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });
    });

    describe('PATCH regular field update (body/status)', () => {
        function setUpEditAttempt(overrides: { commentUserId: string; permissions?: string[] }) {
            return async () => {
                const { parseCrudRequest } = await import('@ottabase/ottaorm');
                const { Post } = await import('@ottabase/ottablog');
                const { Comment } = await import('@ottabase/comments');
                const { getSecurityContext } = await import('../../lib/auth-utils');

                (getSecurityContext as any).mockResolvedValueOnce({
                    organizationId: 'org-1',
                    appId: 'otta-web',
                    permissions: overrides.permissions ?? [],
                });
                (parseCrudRequest as any).mockResolvedValue({
                    model: 'comments',
                    method: 'PATCH',
                    id: 'c1',
                    body: { body: 'edited text' },
                });
                (Comment.find as any).mockResolvedValue(
                    makeCommentStub({
                        id: 'c1',
                        targetType: 'post',
                        targetId: 'post-1',
                        organizationId: 'org-1',
                        userId: overrides.commentUserId,
                    }),
                );
                (Post.find as any).mockResolvedValue({ get: () => 'org-1' });
            };
        }

        it('rejects an edit from someone who is neither the author nor a moderator', async () => {
            const { executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            await setUpEditAttempt({ commentUserId: 'user-2' })();

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('FORBIDDEN');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('allows the comment author to edit their own comment', async () => {
            const { executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 200 });
            await setUpEditAttempt({ commentUserId: 'user-1' })();

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(200);
            expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        });

        it("allows a caller with comments:moderate permission to act on someone else's comment", async () => {
            const { executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 200 });
            await setUpEditAttempt({ commentUserId: 'user-2', permissions: ['comments:moderate'] })();

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(200);
            expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        });

        it('blocks cross-tenant moderation: comments:moderate in the active org does not authorize moderating a comment whose post is in another org', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            // Active org is org-Y with comments:moderate; the comment's post lives in org-X.
            (getSecurityContext as any).mockResolvedValueOnce({
                organizationId: 'org-Y',
                appId: 'otta-web',
                permissions: ['comments:moderate'],
            });
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { status: 'deleted' },
            });
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({
                    id: 'c1',
                    targetType: 'post',
                    targetId: 'post-x',
                    organizationId: 'org-X',
                    userId: 'author',
                }),
            );
            (Post.find as any).mockResolvedValue({ get: () => 'org-X' });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('FORBIDDEN');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('lets a platform admin moderate a comment in any org', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce({
                organizationId: 'org-Y',
                appId: 'otta-web',
                platformAdmin: true,
                permissions: [],
            });
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { status: 'deleted' },
            });
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({
                    id: 'c1',
                    targetType: 'post',
                    targetId: 'post-x',
                    organizationId: 'org-X',
                    userId: 'author',
                }),
            );
            (Post.find as any).mockResolvedValue({ get: () => 'org-X' });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 200 });

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(200);
            expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        });

        it('forces body to [deleted] and clears reactions when status transitions to deleted, regardless of client-supplied body', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment, CommentReaction } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { status: 'deleted', body: 'trying to sneak this text in' },
            });
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({
                    id: 'c1',
                    targetType: 'post',
                    targetId: 'post-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                }),
            );
            (Post.find as any).mockResolvedValue({ get: () => 'org-1' });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 200 });

            await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(call[0].body.body).toBe('[deleted]');
            expect(CommentReaction.deleteForComment as any).toHaveBeenCalledWith('c1');
        });
    });

    describe('GET list', () => {
        it('requires targetType and targetId in the where clause', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'GET',
                query: { where: {} },
            });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(400);
            expect(body.code).toBe('VALIDATION_ERROR');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        it('derives organizationId from the target post rather than the caller ambient org', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce({ organizationId: 'org-CALLER', appId: 'otta-web' });
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'GET',
                query: { where: { targetType: 'post', targetId: 'post-1', status: 'active' } },
            });
            (Post.find as any).mockResolvedValue({
                get: (key: string) => (key === 'organizationId' ? 'org-POST' : null),
            });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(call[1].organizationId).toBe('org-POST');
        });
    });
});
