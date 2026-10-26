/**
 * Locked (invite-only) categories through the public router: what a reader without access gets
 * (nothing, or a teaser), what a reader with access gets (everything), and that every public
 * surface asks the same question in the blog's scope.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationMember, Role, User, UserRole } from '@ottabase/ottaorm';
import { createBlogHandlers } from '../router';
import type { BlogRouterConfig } from '../router';

vi.mock('../ottaorm-models', () => ({
    Post: {
        entity: 'posts',
        deferred: ['content', 'footnotes', 'privateNotes'],
        first: vi.fn(async () => null),
        where: vi.fn(async () => []),
        paginate: vi.fn(async () => ({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 })),
        searchPaginate: vi.fn(async () => ({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 })),
        searchPostIds: vi.fn(async () => []),
        related: vi.fn(async () => []),
    },
    PostCategory: {
        entity: 'categories',
        find: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        where: vi.fn(async () => []),
        whereIn: vi.fn(async () => []),
        lockedIdsForScope: vi.fn(async () => new Set()),
        effectiveLockedIds: vi.fn(
            (rows: { id: string; isLocked: boolean }[]) =>
                new Set(rows.filter((row) => row.isLocked).map((row) => row.id)),
        ),
    },
    PostCategoryLink: { entity: 'post_category_links', where: vi.fn(async () => []) },
    PostSeries: { entity: 'series', find: vi.fn(async () => null), whereIn: vi.fn(async () => []) },
    PostTag: { entity: 'post_tags', whereIn: vi.fn(async () => []) },
    PostTagLink: { entity: 'post_tag_links', where: vi.fn(async () => []) },
    OttablogSettings: {
        forScopeOrPlatform: vi.fn(async () => null),
        ensureOwn: vi.fn(),
    },
    PostTranslation: {
        forPublicPosts: vi.fn(async () => []),
        forPublicFeed: vi.fn(async () => []),
        findForPost: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        searchPostIds: vi.fn(async () => []),
    },
    OttablogTheme: {},
    OttablogPlugin: {},
}));

import { OttablogSettings, Post, PostCategory, PostCategoryLink } from '../ottaorm-models';

type Env = Record<string, never>;

const ctxFor = (path: string, init?: RequestInit) => ({
    request: new Request(`https://x.test${path}`, init),
    env: {} as Env,
    url: new URL(`https://x.test${path}`),
});

const model = (json: Record<string, unknown>) => ({
    get: (field: string) => json[field],
    toJson: () => ({ ...json }),
});

const lockedPost = {
    id: 'p-life',
    title: 'A letter to my father',
    slug: 'a-letter',
    excerpt: 'Some things I never said.',
    content: { blocks: [{ type: 'paragraph', data: { text: 'private body' } }] },
    contentType: 'blog',
    status: 'published',
    heroImage: { url: 'https://images.test/hero.jpg' },
    isLocked: true,
    authorId: null,
    publishedAt: 1,
};

/** Category `c-life` is locked; posts link to it. */
function lockLife(teaser: string[] = []) {
    vi.mocked(PostCategory.lockedIdsForScope).mockResolvedValue(new Set(['c-life']));
    vi.mocked(PostCategoryLink.where).mockResolvedValue([model({ postId: 'p-life', categoryId: 'c-life' })] as any);
    vi.mocked(PostCategory.whereIn).mockResolvedValue([model({ id: 'c-life', name: 'Life', slug: 'life' })] as any);
    vi.mocked(OttablogSettings.forScopeOrPlatform).mockResolvedValue({
        config: () => ({
            defaultLanguage: 'en',
            supportedLanguages: [{ code: 'en', name: 'English' }],
            fallbackToDefault: true,
        }),
        lockedTeaser: () => teaser,
    } as any);
}

function page(...rows: Record<string, unknown>[]) {
    vi.mocked(Post.paginate).mockResolvedValue({
        data: rows.map(model),
        page: 1,
        perPage: 15,
        total: rows.length,
        totalPages: 1,
    } as any);
}

function handlersWith(overrides: Partial<BlogRouterConfig<Env>> = {}) {
    return createBlogHandlers<Env>({
        connect: () => null,
        defaultAppId: () => 'app',
        requireAdmin: async () => ({ session: null }),
        checkCronAuth: () => false,
        verifyPassword: vi.fn(async () => true),
        ...overrides,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PostCategory.lockedIdsForScope).mockResolvedValue(new Set());
    vi.mocked(PostCategoryLink.where).mockResolvedValue([]);
    vi.mocked(PostCategory.whereIn).mockResolvedValue([]);
    vi.mocked(OttablogSettings.forScopeOrPlatform).mockResolvedValue(null);
    vi.mocked(Post.paginate).mockResolvedValue({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 } as any);
    vi.mocked(Post.first).mockResolvedValue(null);
});

describe('posts list', () => {
    it('adds nothing and checks no access when no category is locked', async () => {
        const canReadLocked = vi.fn(async () => false);
        await handlersWith({ canReadLocked }).handleBlogPostsList(ctxFor('/posts'));

        expect(canReadLocked).not.toHaveBeenCalled();
        expect(vi.mocked(Post.paginate).mock.calls[0][2]).not.toHaveProperty('isLocked');
    });

    it('hides locked posts in SQL when teasers are off, and never lets a response be shared', async () => {
        lockLife([]);
        const response = await handlersWith().handleBlogPostsList(ctxFor('/posts'));

        expect(vi.mocked(Post.paginate).mock.calls[0][2]).toMatchObject({ isLocked: false });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it('drops a locked post whose stored flag went stale (its category links are checked too)', async () => {
        lockLife([]);
        page({ ...lockedPost, isLocked: false });

        const body = await (await handlersWith().handleBlogPostsList(ctxFor('/posts'))).json();

        expect(body.data).toEqual([]);
    });

    it('serves a teaser with only the allowed fields when teasers are on', async () => {
        lockLife(['title', 'excerpt']);
        page(lockedPost);

        const response = await handlersWith().handleBlogPostsList(ctxFor('/posts'));
        const where = vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;
        const [post] = (await response.json()).data;

        // Blurbs cannot be teased (their title is their text), so SQL still keeps locked ones out.
        expect(where.$or).toEqual([{ isLocked: false }, { contentType: { $ne: 'blurb' } }]);
        expect(post).toMatchObject({
            teaser: true,
            isLocked: true,
            title: lockedPost.title,
            excerpt: lockedPost.excerpt,
        });
        expect(post.heroImage).toBeNull();
        expect(post.content).toBeUndefined();
        expect(post.tags).toBeUndefined();
        expect(post.categories).toEqual([{ id: 'c-life', name: 'Life', slug: 'life', isLocked: true }]);
    });

    it('hides every locked post from search, even with teasers on (no excerpt oracle)', async () => {
        lockLife(['title', 'excerpt']);
        await handlersWith().handleBlogPostsList(ctxFor('/posts?search=father'));

        expect(vi.mocked(Post.searchPaginate).mock.calls[0][4]).toMatchObject({ isLocked: false });
    });

    it('serves everything, flagged, to a reader with access, asked in the platform scope', async () => {
        lockLife([]);
        page(lockedPost);
        const canReadLocked = vi.fn(async () => true);

        const response = await handlersWith({ canReadLocked }).handleBlogPostsList(ctxFor('/posts'));
        const [post] = (await response.json()).data;

        expect(canReadLocked).toHaveBeenCalledWith(expect.anything(), { organizationId: null });
        expect(vi.mocked(Post.paginate).mock.calls[0][2]).not.toHaveProperty('isLocked');
        expect(post).toMatchObject({ isLocked: true, title: lockedPost.title });
        expect(post.teaser).toBeUndefined();
    });

    it('asks in the resolved organization on an org blog', async () => {
        lockLife([]);
        const canReadLocked = vi.fn(async () => true);
        await handlersWith({
            canReadLocked,
            mode: 'org',
            resolveOrganizationId: async () => 'org-1',
        }).handleBlogPostsList(ctxFor('/posts'));

        expect(canReadLocked).toHaveBeenCalledWith(expect.anything(), { organizationId: 'org-1' });
    });

    it('fails closed when the access check throws', async () => {
        lockLife([]);
        const canReadLocked = vi.fn(async () => {
            throw new Error('kv down');
        });
        await handlersWith({ canReadLocked }).handleBlogPostsList(ctxFor('/posts'));

        expect(vi.mocked(Post.paginate).mock.calls[0][2]).toMatchObject({ isLocked: false });
    });
});

describe('single post', () => {
    it('answers 404 for a locked post when teasers are off', async () => {
        lockLife([]);
        vi.mocked(Post.first).mockResolvedValue(model(lockedPost) as any);

        const response = await handlersWith().handleBlogPostBySlug(ctxFor('/posts/by-slug/a-letter'), 'a-letter');

        expect(response.status).toBe(404);
    });

    it('serves the teaser, never the body, when teasers are on', async () => {
        lockLife(['title', 'heroImage']);
        vi.mocked(Post.first).mockResolvedValue(model(lockedPost) as any);

        const response = await handlersWith().handleBlogPostBySlug(ctxFor('/posts/by-slug/a-letter'), 'a-letter');
        const post = await response.json();

        expect(post).toMatchObject({ teaser: true, title: lockedPost.title, heroImage: lockedPost.heroImage });
        expect(post.excerpt).toBeNull();
        expect(JSON.stringify(post)).not.toContain('private body');
        expect(post.allowComments).toBe(false);
    });

    it('never teases a locked blurb', async () => {
        lockLife(['title', 'excerpt']);
        vi.mocked(Post.first).mockResolvedValue(model({ ...lockedPost, contentType: 'blurb' }) as any);

        const response = await handlersWith().handleBlogPostBySlug(ctxFor('/posts/by-slug/a-letter'), 'a-letter');

        expect(response.status).toBe(404);
    });

    it('serves the full post to a reader with access', async () => {
        lockLife([]);
        vi.mocked(Post.first).mockResolvedValue(model(lockedPost) as any);

        const response = await handlersWith({ canReadLocked: async () => true }).handleBlogPostBySlug(
            ctxFor('/posts/by-slug/a-letter'),
            'a-letter',
        );
        const post = await response.json();

        expect(post.isLocked).toBe(true);
        expect(post.content).toEqual(lockedPost.content);
    });

    it('does not let a password open a locked post', async () => {
        lockLife(['title']);
        vi.mocked(Post.first).mockResolvedValue(model({ ...lockedPost, isProtected: true, passwordHash: 'h' }) as any);
        const verifyPassword = vi.fn(async () => true);

        const response = await handlersWith({ verifyPassword }).handleBlogPostUnlock(
            ctxFor('/posts/unlock', { method: 'POST', body: JSON.stringify({ slug: 'a-letter', password: 'pw' }) }),
        );

        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('LOCKED');
        expect(verifyPassword).not.toHaveBeenCalled();
    });
});

describe('other public surfaces', () => {
    it('hides a locked category when teasers are off and flags it when they are on', async () => {
        vi.mocked(PostCategory.findBySlug).mockResolvedValue(
            model({ id: 'c-life', name: 'Life', isLocked: true }) as any,
        );

        lockLife([]);
        expect((await handlersWith().handleBlogCategoryBySlug(ctxFor('/categories/by-slug/life'), 'life')).status).toBe(
            404,
        );

        lockLife(['title']);
        const response = await handlersWith().handleBlogCategoryBySlug(ctxFor('/categories/by-slug/life'), 'life');
        expect(await response.json()).toMatchObject({ id: 'c-life', isLocked: true });
    });

    it('builds RSS as the anonymous view, without asking who is fetching', async () => {
        lockLife([]);
        const canReadLocked = vi.fn(async () => true);

        await handlersWith({ canReadLocked }).handleBlogRssFeed(ctxFor('/rss'));

        expect(canReadLocked).not.toHaveBeenCalled();
        expect(vi.mocked(Post.where).mock.calls[0][0]).toMatchObject({ isLocked: false });
    });

    it('never suggests locked posts as related reading to a reader without access', async () => {
        lockLife(['title']);
        vi.mocked(Post.first).mockResolvedValue(model({ ...lockedPost, id: 'p-open', isLocked: false }) as any);
        vi.mocked(PostCategoryLink.where).mockResolvedValue([]);

        await handlersWith().handleBlogRelatedPosts(ctxFor('/posts/p-open/related'), 'p-open');

        expect(vi.mocked(Post.related).mock.calls[0][1]).toMatchObject({ excludeLocked: true });
    });
});

describe('studio access', () => {
    const admin = async () => ({ session: { user: { id: 'admin-1' } } });

    it('requires a studio admin', async () => {
        const denied = new Response('no', { status: 403 });
        const response = await handlersWith({ requireAdmin: async () => denied }).handleBlogStudioAccess(
            ctxFor('/studio/access'),
        );
        expect(response.status).toBe(403);
    });

    it('saves the teaser on the scope row', async () => {
        const updateLockedTeaser = vi.fn();
        vi.mocked(OttablogSettings.ensureOwn).mockResolvedValue({ updateLockedTeaser } as any);
        vi.spyOn(Role, 'findByName').mockResolvedValue(null);

        const response = await handlersWith({ requireAdmin: admin }).handleBlogStudioAccess(
            ctxFor('/studio/access', { method: 'POST', body: JSON.stringify({ lockedTeaser: ['title', 'excerpt'] }) }),
        );

        expect(response.status).toBe(200);
        expect(OttablogSettings.ensureOwn).toHaveBeenCalledWith({ appId: 'app', organizationId: undefined });
        expect(updateLockedTeaser).toHaveBeenCalledWith(['title', 'excerpt']);
    });

    it('invites an existing account with a system-scoped insider grant on the platform blog', async () => {
        const assignRole = vi.fn();
        vi.spyOn(User, 'findByEmail').mockResolvedValue({ get: () => 'u-2', assignRole } as any);
        vi.spyOn(Role, 'findByName').mockResolvedValue({ get: () => 'role-insider' } as any);
        vi.spyOn(UserRole, 'where').mockResolvedValue([]);
        vi.spyOn(User, 'whereIn').mockResolvedValue([]);
        const onReaderAccessChanged = vi.fn();

        const response = await handlersWith({ requireAdmin: admin, onReaderAccessChanged }).handleBlogStudioReaderGrant(
            ctxFor('/studio/access/readers', {
                method: 'POST',
                body: JSON.stringify({ email: ' Friend@Example.com ' }),
            }),
        );

        expect(response.status).toBe(200);
        expect(User.findByEmail).toHaveBeenCalledWith('friend@example.com');
        expect(assignRole).toHaveBeenCalledWith('role-insider', 'admin-1', 'system');
        expect(onReaderAccessChanged).toHaveBeenCalledWith({}, 'u-2');
    });

    it('asks for an account first, and for org membership on an org blog', async () => {
        vi.spyOn(User, 'findByEmail').mockResolvedValueOnce(null);
        const grant = (overrides: Partial<BlogRouterConfig<Env>> = {}) =>
            handlersWith({ requireAdmin: admin, ...overrides }).handleBlogStudioReaderGrant(
                ctxFor('/studio/access/readers', { method: 'POST', body: JSON.stringify({ email: 'a@b.co' }) }),
            );

        expect((await grant()).status).toBe(404);

        vi.spyOn(User, 'findByEmail').mockResolvedValueOnce({ get: () => 'u-3', assignRole: vi.fn() } as any);
        vi.spyOn(OrganizationMember, 'isMember').mockResolvedValueOnce(false);
        const response = await grant({
            mode: 'org',
            resolveOrganizationId: async () => 'org-1',
            requireScopedStudioAdmin: admin,
        });
        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe('NOT_A_MEMBER');
    });

    it('revokes in the same scope', async () => {
        vi.spyOn(Role, 'findByName').mockResolvedValue({ get: () => 'role-insider' } as any);
        const removeRole = vi.spyOn(UserRole, 'removeRole').mockResolvedValue(undefined as any);
        vi.spyOn(UserRole, 'where').mockResolvedValue([]);
        vi.spyOn(User, 'whereIn').mockResolvedValue([]);

        await handlersWith({ requireAdmin: admin }).handleBlogStudioReaderRevoke(
            ctxFor('/studio/access/readers/u-2', { method: 'DELETE' }),
            'u-2',
        );

        expect(removeRole).toHaveBeenCalledWith('u-2', 'role-insider', 'system');
    });
});
