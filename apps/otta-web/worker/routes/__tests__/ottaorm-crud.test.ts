import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOttaormCrud } from '../ottaorm-crud';

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    hashPassword: vi.fn(async (value: string) => `hashed-${value}`), // otta:only ottablog
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: vi.fn(() => ({})),
}));

vi.mock('@ottabase/ottaorm', () => ({
    parseCrudRequest: vi.fn(),
    executeSecureCrudRequest: vi.fn(),
    registerConnection: vi.fn(),
    mediaFileStore: {},
}));

/**
 * A context shaped like the real getSecurityContext output for signed-in user-1: membership is
 * always resolved, and the active org is one of those memberships. These route tests stub
 * executeSecureCrudRequest, so the RLS engine never sees this — keep it realistic anyway; the
 * real context → RLS path is covered by worker/lib/__tests__/tenant-isolation.test.ts.
 */
function signedInContext(overrides: Record<string, unknown> = {}) {
    return {
        userId: 'user-1',
        organizationId: 'org-1',
        appId: 'otta-web',
        platformAdmin: false,
        memberOrganizationIds: ['org-1'],
        memberGroupIds: [],
        ...overrides,
    };
}

vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: vi.fn(() => ({})),
    getSecurityContext: vi.fn(async () => signedInContext()),
    invalidateMembershipCache: vi.fn(),
}));

// otta:begin ottablog
// Post is stubbed, but the blurb/photo VALIDATORS are the real ones: this route re-applies them so
// generic CRUD cannot skip the caps the dedicated blog routes enforce. Pulled from the pure types
// module (no ottaorm import) so the mocked ottaorm above does not break the model class it exports.
vi.mock('@ottabase/ottablog', async () => ({
    ...(await vi.importActual<typeof import('../../../../../packages/ottablog/src/types')>(
        '../../../../../packages/ottablog/src/types',
    )),
    // The real unlock-token signer: the comments route verifies what the unlock route mints.
    ...(await vi.importActual<typeof import('../../../../../packages/ottablog/src/preview-token')>(
        '../../../../../packages/ottablog/src/preview-token',
    )),
    Post: { find: vi.fn(), first: vi.fn() },
}));
// otta:end ottablog

// otta:begin comments
vi.mock('@ottabase/comments', () => ({
    Comment: { find: vi.fn(), validateReplyParent: vi.fn() },
    CommentReaction: { toggle: vi.fn(), deleteForComment: vi.fn(), reactionsFor: vi.fn() },
    UNPUBLISHED_COMMENT_STATUSES: ['pending', 'hidden'],
}));
// otta:end comments

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

// otta:begin ottablog
function installAuthorizedPostExecution(
    executeSecureCrudRequest: { mockImplementation: (implementation: (...args: any[]) => unknown) => void },
    currentData?: Record<string, unknown>,
) {
    const captured: { body?: Record<string, unknown> } = {};
    executeSecureCrudRequest.mockImplementation(async (request: any, context: any, hooks: any) => {
        const prepared = await hooks.prepareAuthorizedMutation({
            method: request.method,
            model: request.model,
            id: request.id,
            body: request.body,
            currentData,
            context,
        });
        if ('success' in prepared) return prepared;
        captured.body = prepared.body;
        return { success: true, data: { id: request.id ?? 'post-1', ...prepared.body }, status: 200 };
    });
    return captured;
}
// otta:end ottablog

describe('handleOttaormCrud (posts concurrency)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // otta:begin ottablog
    it('returns 409 when expectedUpdatedAt does not match', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Post } = await import('@ottabase/ottablog');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { expectedUpdatedAt: 1000 },
        });
        installAuthorizedPostExecution(executeSecureCrudRequest as any, { id: 'post-1', updatedAt: 2000 });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(409);
        expect(executeSecureCrudRequest as any).toHaveBeenCalledOnce();
        expect(Post.find).not.toHaveBeenCalled();
    });

    it('removes expectedUpdatedAt before executing the update', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { expectedUpdatedAt: 1000, title: 'Next title' },
        });
        const captured = installAuthorizedPostExecution(executeSecureCrudRequest as any, {
            id: 'post-1',
            updatedAt: 1000,
            status: 'draft',
        });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(200);
        expect(captured.body?.expectedUpdatedAt).toBeUndefined();
    });
    // otta:end ottablog

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
        'accounts',
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

    it.each([
        'media',
        'posts', // otta:only ottablog
        'categories', // otta:only ottablog
        'series', // otta:only ottablog
    ])('ALLOWS generic CRUD for the allow-listed app-data model %s', async (model) => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({ model, method: 'GET' });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: [], status: 200 });

        const response = await handleOttaormCrud(createContext());
        expect(response.status).toBe(200);
        expect(executeSecureCrudRequest as any).toHaveBeenCalled();
    });
});

// otta:begin ottablog
describe('handleOttaormCrud (posts null-org authoring guard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a non-platform-admin creating a post with no active org (null-org is platform-owned)', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { getSecurityContext } = await import('../../lib/auth-utils');

        (getSecurityContext as any).mockResolvedValueOnce(signedInContext({ organizationId: null }));
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

        (getSecurityContext as any).mockResolvedValueOnce(
            signedInContext({ organizationId: null, platformAdmin: true, memberOrganizationIds: [] }),
        );
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'POST',
            body: { title: 'Platform post', slug: 'platform-post', status: 'draft' },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'post-1' }, status: 200 });

        const response = await handleOttaormCrud(createContext());
        const call = (executeSecureCrudRequest as any).mock.calls[0];

        expect(response.status).toBe(200);
        expect(call[1].organizationId).toBeNull();
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
        const call = (executeSecureCrudRequest as any).mock.calls[0];

        expect(response.status).toBe(200);
        expect(call[1].organizationId).toBe('org-1');
    });
});

describe('handleOttaormCrud (authorized post mutation policy)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('requires publish permission when editing or leaving an already-live state', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { title: 'Changed without mentioning status' },
        });
        installAuthorizedPostExecution(executeSecureCrudRequest as any, {
            id: 'post-1',
            status: 'published',
            updatedAt: 1000,
        });

        const response = await handleOttaormCrud(createContext());
        expect(response.status).toBe(403);
        expect(((await response.json()) as any).code).toBe('FORBIDDEN');
    });

    it('requires publish permission for a draft-to-scheduled transition', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { status: 'scheduled', publishAt: Date.now() + 60_000 },
        });
        installAuthorizedPostExecution(executeSecureCrudRequest as any, {
            id: 'post-1',
            status: 'draft',
            updatedAt: 1000,
        });

        expect((await handleOttaormCrud(createContext())).status).toBe(403);
    });

    it('strips server-owned fields and preserves stored attribution for an authorized editor', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { getSecurityContext } = await import('../../lib/auth-utils');
        (getSecurityContext as any).mockResolvedValueOnce(
            signedInContext({ userId: 'manager-1', permissions: ['posts:publish', 'posts:manage'] }),
        );
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: {
                title: 'Manager edit',
                authorId: 'attacker',
                userId: 'attacker',
                organizationId: 'org-other',
                appId: 'other-app',
                publishedAt: 1,
                postedAt: 1,
                wordCount: 999_999,
            },
        });
        const captured = installAuthorizedPostExecution(executeSecureCrudRequest as any, {
            id: 'post-1',
            status: 'published',
            authorId: 'original-author',
            userId: 'original-author',
            organizationId: 'org-1',
            appId: 'otta-web',
            updatedAt: 1000,
        });

        expect((await handleOttaormCrud(createContext())).status).toBe(200);
        expect(captured.body).toEqual({ title: 'Manager edit' });
    });

    it('uses the authorized hidden snapshot for password protection', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { isProtected: true },
        });
        installAuthorizedPostExecution(executeSecureCrudRequest as any, {
            id: 'post-1',
            status: 'draft',
            passwordHash: null,
            updatedAt: 1000,
        });

        const response = await handleOttaormCrud(createContext());
        expect(response.status).toBe(400);
        expect(((await response.json()) as any).fieldErrors.password).toEqual([
            'Password is required when enabling protection',
        ]);
    });

    it('rejects PUT before secure CRUD because posts use PATCH semantics', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PUT',
            id: 'post-1',
            body: { title: 'Replacement' },
        });

        const response = await handleOttaormCrud(createContext());
        expect(response.status).toBe(405);
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });
});

describe('handleOttaormCrud (posts blurb/photo-journal shape validation)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies the album cap to a generic CRUD write, not just the dedicated blog route', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: {
                photoAlbum: Array.from({ length: 61 }, (_, index) => ({
                    id: `p${index}`,
                    image: `https://images.test/${index}.jpg`,
                })),
            },
        });

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(400);
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('normalizes an accepted album and leaves posts without these columns untouched', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            // A javascript: URL must not survive into the stored album.
            body: { blurbText: '  A thought  ', photoAlbum: [{ id: 'p1', image: 'https://images.test/1.jpg' }] },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'post-1' }, status: 200 });

        const response = await handleOttaormCrud(createContext());
        const call = (executeSecureCrudRequest as any).mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(call.body.blurbText).toBe('A thought');
        expect(call.body.photoAlbum).toEqual([expect.objectContaining({ image: 'https://images.test/1.jpg' })]);
    });

    it('validates crossposts on the generic route, which is the only way an article writes them', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { contentType: 'blog', crossposts: [{ url: 'javascript:alert(1)' }] },
        });

        const rejected = await handleOttaormCrud(createContext());
        expect(rejected.status).toBe(400);
        expect(((await rejected.json()) as any).code).toBe('VALIDATION_ERROR');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { contentType: 'blog', crossposts: ['  https://www.instagram.com/p/abc  ', { url: '' }] },
        });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'post-1' }, status: 200 });

        const accepted = await handleOttaormCrud(createContext());
        expect(accepted.status).toBe(200);
        // Trimmed, normalized to objects, blank row dropped — same shape the blog routes store.
        expect((executeSecureCrudRequest as any).mock.calls[0][0].body.crossposts).toEqual([
            { url: 'https://www.instagram.com/p/abc' },
        ]);
    });

    it('applies the post body ceiling to every content type, not just photo journals', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { POST_CONTENT_MAX_BYTES } = await import('@ottabase/ottablog');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            // A plain article: the body column is shared, so the cap cannot be journal-only.
            body: {
                contentType: 'blog',
                content: { blocks: [{ type: 'paragraph', data: { text: 'x'.repeat(POST_CONTENT_MAX_BYTES + 1) } }] },
            },
        });

        const response = await handleOttaormCrud(createContext());
        const body = (await response.json()) as any;

        expect(response.status).toBe(400);
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('rejects a post body that is not editor content', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { content: { blocks: 'not-an-array' } },
        });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(400);
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('rejects an unsafe photograph URL', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { photoAlbum: [{ id: 'p1', image: 'javascript:alert(1)' }] },
        });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(400);
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });
});
// otta:end ottablog

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
        (getSecurityContext as any).mockResolvedValueOnce(signedInContext(ctxOverride));
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

// otta:begin comments
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
            (Post.first as any).mockResolvedValue({
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
            expect(call[0].body.appId).toBe('otta-web');
            expect(Post.first).toHaveBeenCalledWith({ id: 'post-1', appId: 'otta-web' });
        });

        it('returns 404 when the target post does not exist', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'missing-post' },
            });
            (Post.first as any).mockResolvedValue(null);

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
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
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
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: true, depth: 2 });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 201 });

            await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(call[0].body.depth).toBe(2);
        });
    });

    describe('POST create on a password-protected post', () => {
        const SECRET = 'auth-secret-for-unlock-tokens-32ch';
        const lockedPost = (key: string) =>
            ({ id: 'post-1', organizationId: 'org-1', isProtected: true, passwordHash: 'hash', authorId: 'author-9' })[
                key
            ] ?? null;

        async function setUpLockedCreate(context = signedInContext()) {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce(context);
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'post-1' },
            });
            (Post.first as any).mockResolvedValue({ get: lockedPost });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: true, depth: 0 });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'c1' }, status: 201 });
            return executeSecureCrudRequest as any;
        }

        function lockedContext(headers: Record<string, string> = {}) {
            const request = new Request('https://example.com/api/ottaorm/comments', { method: 'POST', headers });
            return { request, env: { OBCF_D1: {}, AUTH_SECRET: SECRET }, url: new URL(request.url) } as any;
        }

        it('answers 403 POST_LOCKED without an unlock token', async () => {
            const execute = await setUpLockedCreate();

            const response = await handleOttaormCrud(lockedContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('POST_LOCKED');
            expect(execute).not.toHaveBeenCalled();
        });

        it('accepts the comment with an unlock token for this post, and refuses one for another post', async () => {
            const { signUnlockToken } = await import('@ottabase/ottablog');
            const forThis = await signUnlockToken(SECRET, {
                postId: 'post-1',
                appId: 'otta-web',
                organizationId: 'org-1',
            });
            const forOther = await signUnlockToken(SECRET, {
                postId: 'post-2',
                appId: 'otta-web',
                organizationId: 'org-1',
            });

            let execute = await setUpLockedCreate();
            expect((await handleOttaormCrud(lockedContext({ 'X-Post-Unlock': forOther.token }))).status).toBe(403);
            expect(execute).not.toHaveBeenCalled();

            execute = await setUpLockedCreate();
            expect((await handleOttaormCrud(lockedContext({ 'X-Post-Unlock': forThis.token }))).status).toBe(201);
            expect(execute).toHaveBeenCalledOnce();
        });

        it('lets a moderator of the post org comment without unlocking', async () => {
            const execute = await setUpLockedCreate(signedInContext({ permissions: ['comments:moderate'] }));

            expect((await handleOttaormCrud(lockedContext())).status).toBe(201);
            expect(execute).toHaveBeenCalledOnce();
        });

        it("lets the post's author comment without unlocking", async () => {
            const { getSession } = await import('@ottabase/auth/backend');
            (getSession as any).mockResolvedValueOnce({ user: { id: 'author-9' } });
            const execute = await setUpLockedCreate(signedInContext({ userId: 'author-9' }));

            expect((await handleOttaormCrud(lockedContext())).status).toBe(201);
            expect(execute).toHaveBeenCalledOnce();
        });
    });

    describe('POST create, anonymous (rate limit and Turnstile)', () => {
        const KEYS = { TURNSTILE_SITE_KEY: '0x4AAAAAAA-site_key', TURNSTILE_SECRET_KEY: 'secret' };
        const allow = { limit: async () => ({ success: true }) };

        function anonymousPost(env: Record<string, unknown>, headers: Record<string, string> = {}) {
            const request = new Request('https://example.com/api/ottaorm/comments', {
                method: 'POST',
                headers: { 'CF-Connecting-IP': '203.0.113.7', ...headers },
            });
            return { request, env: { OBCF_D1: {}, ...env }, url: new URL(request.url) } as any;
        }

        async function setUpAnonymousCreate() {
            const { getSession } = await import('@ottabase/auth/backend');
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSession as any).mockResolvedValueOnce(null);
            (getSecurityContext as any).mockResolvedValueOnce({ organizationId: null, appId: 'otta-web' });
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'post-1', authorName: 'Ada' },
            });
            // A platform blog post: no organization.
            (Post.first as any).mockResolvedValue({ get: (key: string) => (key === 'allowComments' ? true : null) });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: true, depth: 0 });
            (executeSecureCrudRequest as any).mockResolvedValue({
                success: true,
                data: { id: 'c1', status: 'pending' },
                status: 201,
            });
            return executeSecureCrudRequest as any;
        }

        afterEach(() => vi.unstubAllGlobals());

        it('answers 403 TURNSTILE_FAILED without a token when both keys are set', async () => {
            const execute = await setUpAnonymousCreate();

            const response = await handleOttaormCrud(anonymousPost({ ...KEYS, OBCF_RATE_LIMITER: allow }));
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('TURNSTILE_FAILED');
            expect(execute).not.toHaveBeenCalled();
        });

        it('creates the comment once siteverify accepts a comment token, in the null org of a platform post', async () => {
            const execute = await setUpAnonymousCreate();
            const fetchMock = vi.fn(async () =>
                Response.json({ success: true, action: 'comment', hostname: 'example.com', 'error-codes': [] }),
            );
            vi.stubGlobal('fetch', fetchMock);

            const response = await handleOttaormCrud(
                anonymousPost({ ...KEYS, OBCF_RATE_LIMITER: allow }, { 'X-Turnstile-Token': 'token' }),
            );
            const call = execute.mock.calls[0];

            expect(response.status).toBe(201);
            expect(fetchMock).toHaveBeenCalledOnce();
            expect(call[0].body).toMatchObject({ userId: null, organizationId: null, authorName: 'Ada' });
            expect(call[1].organizationId).toBeNull();
        });

        it('rate limits per IP and skips Turnstile when the keys are unset', async () => {
            const execute = await setUpAnonymousCreate();
            const keys: string[] = [];
            const limiter = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) };

            const response = await handleOttaormCrud(anonymousPost({ OBCF_RATE_LIMITER: limiter }));

            expect(response.status).toBe(201);
            expect(keys).toEqual(['comments:create:203.0.113.7']);
            expect(execute).toHaveBeenCalled();
        });

        // otta:begin demo
        it("accepts a guest's comment on the demo page's thread, in the null org", async () => {
            const execute = await setUpAnonymousCreate();
            const { parseCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'demo', targetId: 'comments-demo-page', authorName: 'Ada' },
            });

            const response = await handleOttaormCrud(anonymousPost({ OBCF_RATE_LIMITER: allow }));
            const call = execute.mock.calls[0];

            expect(response.status).toBe(201);
            expect(Post.first).not.toHaveBeenCalled();
            expect(call[0].body).toMatchObject({ userId: null, organizationId: null, authorName: 'Ada' });
            expect(call[1].organizationId).toBeNull();
        });
        // otta:end demo

        it('answers 429 when the limiter says no', async () => {
            const execute = await setUpAnonymousCreate();

            const response = await handleOttaormCrud(
                anonymousPost({ ...KEYS, OBCF_RATE_LIMITER: { limit: async () => ({ success: false }) } }),
            );

            expect(response.status).toBe(429);
            expect(execute).not.toHaveBeenCalled();
        });

        it('lets a signed-in commenter through without a token even when both keys are set', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'post-1' },
            });
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
            (Comment.validateReplyParent as any).mockResolvedValue({ ok: true, depth: 0 });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { id: 'c1' }, status: 201 });

            const response = await handleOttaormCrud(anonymousPost(KEYS));

            expect(response.status).toBe(201);
            expect((executeSecureCrudRequest as any).mock.calls[0][0].body.userId).toBe('user-1');
        });

        it('refuses any comment on a post with comments turned off', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'POST',
                body: { body: 'hello', targetType: 'post', targetId: 'post-1' },
            });
            (Post.first as any).mockResolvedValue({
                get: (key: string) => (key === 'allowComments' ? false : 'org-1'),
            });

            const response = await handleOttaormCrud(createContext());
            const body = (await response.json()) as any;

            expect(response.status).toBe(403);
            expect(body.code).toBe('COMMENTS_CLOSED');
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
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
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });

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
            (Post.first as any).mockResolvedValue({ get: () => 'org-REAL' });

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
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
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
                (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
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
            (Post.first as any).mockResolvedValue({ get: () => 'org-X' });

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
            (Post.first as any).mockResolvedValue({ get: () => 'org-X' });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: {}, status: 200 });

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(200);
            expect(executeSecureCrudRequest as any).toHaveBeenCalled();
        });

        it('lets only a moderator publish a pending comment: its author may not change the status', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'PATCH',
                id: 'c1',
                body: { status: 'active' },
            });
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({
                    id: 'c1',
                    targetType: 'post',
                    targetId: 'post-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    status: 'hidden',
                }),
            );
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(403);
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
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
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
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
            (Post.first as any).mockResolvedValue({
                get: (key: string) => (key === 'organizationId' ? 'org-POST' : null),
            });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(call[1].organizationId).toBe('org-POST');
        });

        it('keeps pending and hidden comments out of a non-moderator list, whatever the where asks', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');

            const where = { targetType: 'post', targetId: 'post-1', status: 'pending' };
            (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', query: { where } });
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(call[0].query.where).toEqual({ $and: [where, { status: { $nin: ['pending', 'hidden'] } }] });
        });

        it("leaves a moderator's list as asked", async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce(signedInContext({ permissions: ['comments:moderate'] }));
            const where = { targetType: 'post', targetId: 'post-1', status: 'pending' };
            (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', query: { where } });
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            await handleOttaormCrud(createContext());

            expect((executeSecureCrudRequest as any).mock.calls[0][0].query.where).toEqual(where);
        });

        it("lists a moderator's whole scope without a target, in the ambient org and the app", async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce(signedInContext({ permissions: ['comments:moderate'] }));
            const where = { status: 'pending' };
            (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', query: { where } });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            const response = await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(response.status).toBe(200);
            expect(call[0].query.where).toEqual({ $and: [where, { appId: 'otta-web' }] });
            expect(call[1].organizationId).toBe('org-1');
            expect(Post.first).not.toHaveBeenCalled();
        });

        it("lists a platform admin's platform scope (the null org) without a target", async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSecurityContext as any).mockResolvedValueOnce(
                signedInContext({ organizationId: null, platformAdmin: true }),
            );
            (parseCrudRequest as any).mockResolvedValue({
                model: 'comments',
                method: 'GET',
                query: { where: { status: 'hidden' } },
            });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            await handleOttaormCrud(createContext());

            expect((executeSecureCrudRequest as any).mock.calls[0][1].organizationId).toBeNull();
        });

        it('refuses a targetless list to a moderator with no active org', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            // comments:moderate, but no active org: there is no scope of theirs to list.
            (getSecurityContext as any).mockResolvedValueOnce(
                signedInContext({ organizationId: null, permissions: ['comments:moderate'] }),
            );
            (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', query: { where: {} } });

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(400);
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });

        // otta:begin demo
        it("lists the demo page's public thread to a signed-out visitor, in the null org, published only", async () => {
            const { getSession } = await import('@ottabase/auth/backend');
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { getSecurityContext } = await import('../../lib/auth-utils');

            (getSession as any).mockResolvedValueOnce(null);
            (getSecurityContext as any).mockResolvedValueOnce({ organizationId: null, appId: 'otta-web' });
            const where = { targetType: 'demo', targetId: 'comments-demo-page' };
            (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', query: { where } });
            (executeSecureCrudRequest as any).mockResolvedValue({ success: true, data: { data: [] }, status: 200 });

            const response = await handleOttaormCrud(createContext());
            const call = (executeSecureCrudRequest as any).mock.calls[0];

            expect(response.status).toBe(200);
            expect(call[1].organizationId).toBeNull();
            expect(call[0].query.where).toEqual({ $and: [where, { status: { $nin: ['pending', 'hidden'] } }] });
        });
        // otta:end demo

        it('refuses to filter, look up or sort on the hidden authorEmail', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });
            const target = { targetType: 'post', targetId: 'post-1' };

            for (const query of [
                { where: { ...target, $or: [{ authorEmail: { $startsWith: 'a' } }] } },
                { where: target, field: 'authorEmail', value: 'ada@example.com' },
                { where: target, orderBy: 'authorEmail' },
            ]) {
                (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', query });
                const response = await handleOttaormCrud(createContext());
                expect(response.status).toBe(400);
            }
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });
    });

    describe('GET by id', () => {
        it('answers 404 for a pending comment to anyone but its author and moderators', async () => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            const { Post } = await import('@ottabase/ottablog');
            const { Comment } = await import('@ottabase/comments');

            (parseCrudRequest as any).mockResolvedValue({ model: 'comments', method: 'GET', id: 'c1' });
            (Comment.find as any).mockResolvedValue(
                makeCommentStub({
                    id: 'c1',
                    targetType: 'post',
                    targetId: 'post-1',
                    organizationId: 'org-1',
                    userId: null,
                    status: 'pending',
                }),
            );
            (Post.first as any).mockResolvedValue({ get: () => 'org-1' });

            const response = await handleOttaormCrud(createContext());

            expect(response.status).toBe(404);
            expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
        });
    });
});
// otta:end comments

describe('handleOttaormCrud (media)', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
        'refuses %s: media rows change only through the files service',
        async (method) => {
            const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
            (parseCrudRequest as any).mockResolvedValue({
                model: 'media',
                method,
                id: 'm1',
                body: { storageKey: 'x' },
            });
            const response = await handleOttaormCrud(createContext());
            expect(response.status).toBe(403);
            expect(await response.json()).toMatchObject({ code: 'CRUD_DISABLED' });
            expect(executeSecureCrudRequest).not.toHaveBeenCalled();
        },
    );

    it('lists rows with the URLs the files service computes (none are stored)', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const id = 'c'.repeat(32);
        const row = {
            id,
            appId: 'otta-web',
            audience: 'public',
            storageKey: `otta-web/media/${id}.png`,
            variants: null,
        };
        (parseCrudRequest as any).mockResolvedValue({ model: 'media', method: 'GET' });
        (executeSecureCrudRequest as any).mockResolvedValue({ success: true, status: 200, data: { data: [row] } });
        const body = (await (await handleOttaormCrud(createContext())).json()) as { data: Record<string, string>[] };
        expect(body.data[0]).toMatchObject({
            url: `/api/files/public/otta-web/media/${id}.png`,
            thumbnailUrl: `/api/files/public/otta-web/media/${id}.png`,
        });
    });
});
