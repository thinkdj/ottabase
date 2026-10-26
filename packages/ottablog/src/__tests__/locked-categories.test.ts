/**
 * Locked (invite-only) categories through the public router: what a reader a category is closed to
 * gets (nothing, or a teaser), what a reader it opens to gets (everything), that every public
 * surface asks in the blog's scope, and how a blog's Studio manages audiences.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Organization, User } from '@ottabase/ottaorm';
import type { BlogViewer } from '../lock-key';
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
        seriesIdsOf: vi.fn(async () => []),
    },
    PostCategory: {
        entity: 'categories',
        find: vi.fn(async () => null),
        first: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        where: vi.fn(async () => []),
        whereIn: vi.fn(async () => []),
        lockAccessFor: vi.fn(),
        effectiveLockedIds: vi.fn(
            (rows: { id: string; isLocked: boolean }[]) =>
                new Set(rows.filter((row) => row.isLocked).map((row) => row.id)),
        ),
    },
    PostCategoryLink: { entity: 'post_category_links', where: vi.fn(async () => []) },
    PostSeries: { entity: 'series', find: vi.fn(async () => null), whereIn: vi.fn(async () => []) },
    PostTag: { entity: 'post_tags', findBySlug: vi.fn(async () => null), whereIn: vi.fn(async () => []) },
    PostTagLink: { entity: 'post_tag_links', where: vi.fn(async () => []) },
    OttablogSettings: {
        forBlog: vi.fn(async () => null),
        ensure: vi.fn(),
    },
    PostTranslation: {
        forPublicPosts: vi.fn(async () => []),
        forPublicFeed: vi.fn(async () => []),
        findForPost: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        searchPostIds: vi.fn(async () => []),
    },
    OttablogAudience: {
        forBlog: vi.fn(async () => []),
        findInBlog: vi.fn(async () => null),
        createInBlog: vi.fn(),
        delete: vi.fn(async () => true),
        where: vi.fn(async () => []),
    },
    OttablogAudienceMember: { where: vi.fn(async () => []) },
    OttablogCategoryAudience: { where: vi.fn(async () => []), setForCategory: vi.fn() },
    OttablogTheme: {},
    OttablogPlugin: {},
}));

import {
    OttablogAudience,
    OttablogAudienceMember,
    OttablogCategoryAudience,
    OttablogSettings,
    Post,
    PostCategory,
    PostCategoryLink,
    PostTag,
    PostTagLink,
} from '../ottaorm-models';

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
    lockKey: '|c-life|',
    authorId: null,
    publishedAt: 1,
};

/** Readers the `Family` audience (given `c-life`) opens it to. */
let family = new Set<string>();

/**
 * Category `c-life` is locked and opens to the family audience; `extraLocked` are locked and open
 * to nobody. Posts link to `c-life`.
 */
function lockLife(teaser: string[] = [], extraLocked: string[] = []) {
    vi.mocked(PostCategory.lockAccessFor).mockImplementation(async (_blog, resolve) => {
        const viewer = typeof resolve === 'function' ? await resolve() : resolve;
        const opensLife = viewer.readsAllLocked || (viewer.userId !== null && family.has(viewer.userId));
        const forbidden = viewer.readsAllLocked ? [] : [...(opensLife ? [] : ['c-life']), ...extraLocked];
        return { locked: new Set(['c-life', ...extraLocked]), forbidden: new Set(forbidden) };
    });
    vi.mocked(PostCategoryLink.where).mockResolvedValue([model({ postId: 'p-life', categoryId: 'c-life' })] as any);
    vi.mocked(PostCategory.whereIn).mockResolvedValue([model({ id: 'c-life', name: 'Life', slug: 'life' })] as any);
    vi.mocked(OttablogSettings.forBlog).mockResolvedValue({
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

const reader =
    (userId: string | null, readsAllLocked = false) =>
    async (): Promise<BlogViewer> => ({
        userId,
        readsAllLocked,
    });

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

const listWhere = () => vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;

beforeEach(() => {
    vi.clearAllMocks();
    family = new Set();
    vi.mocked(PostCategory.lockAccessFor).mockResolvedValue({ locked: new Set(), forbidden: new Set() });
    vi.mocked(PostCategoryLink.where).mockResolvedValue([]);
    vi.mocked(PostCategory.whereIn).mockResolvedValue([]);
    vi.mocked(OttablogSettings.forBlog).mockResolvedValue(null);
    vi.mocked(Post.paginate).mockResolvedValue({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 } as any);
    vi.mocked(Post.first).mockResolvedValue(null);
});

describe('posts list', () => {
    it('adds nothing and resolves no reader when no category is locked', async () => {
        const resolveViewer = vi.fn(reader('u1'));
        vi.mocked(PostCategory.lockAccessFor).mockImplementation(async () => ({
            locked: new Set(),
            forbidden: new Set(),
        }));
        await handlersWith({ resolveViewer }).handleBlogPostsList(ctxFor('/posts'));

        expect(resolveViewer).not.toHaveBeenCalled();
        expect(listWhere()).not.toHaveProperty('$and');
    });

    it('hides closed posts in SQL when teasers are off, and never lets a response be shared', async () => {
        lockLife([]);
        const response = await handlersWith().handleBlogPostsList(ctxFor('/posts'));

        expect(listWhere().$and).toEqual([{ lockKey: null }]);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it('drops a closed post whose stored key went stale (its category links are checked too)', async () => {
        lockLife([]);
        page({ ...lockedPost, lockKey: null });

        const body = await (await handlersWith().handleBlogPostsList(ctxFor('/posts'))).json();

        expect(body.data).toEqual([]);
    });

    it('serves a teaser with only the allowed fields when teasers are on', async () => {
        lockLife(['title', 'excerpt']);
        page(lockedPost);

        const response = await handlersWith().handleBlogPostsList(ctxFor('/posts'));
        const [post] = (await response.json()).data;

        // Blurbs cannot be teased (their title is their text), so SQL still keeps closed ones out.
        expect(listWhere().$and).toEqual([{ $or: [{ lockKey: null }, { contentType: { $ne: 'blurb' } }] }]);
        expect(post).toMatchObject({
            teaser: true,
            isLocked: true,
            title: lockedPost.title,
            excerpt: lockedPost.excerpt,
        });
        expect(post.heroImage).toBeNull();
        expect(post.content).toBeUndefined();
        expect(post.tags).toBeUndefined();
        expect(post.lockKey).toBeUndefined();
        expect(post.categories).toEqual([{ id: 'c-life', name: 'Life', slug: 'life', isLocked: true }]);
    });

    it('hides every closed post from search, even with teasers on (no excerpt oracle)', async () => {
        lockLife(['title', 'excerpt']);
        await handlersWith().handleBlogPostsList(ctxFor('/posts?search=father'));

        expect(vi.mocked(Post.searchPaginate).mock.calls[0][4]).toMatchObject({ $and: [{ lockKey: null }] });
    });

    it("opens a category to its audience's members, flagged, and keeps the others closed", async () => {
        lockLife([], ['c-work']);
        family.add('u-mom');
        page(lockedPost);

        const response = await handlersWith({ resolveViewer: reader('u-mom') }).handleBlogPostsList(ctxFor('/posts'));
        const [post] = (await response.json()).data;

        expect(listWhere().$and).toEqual([
            { $or: [{ lockKey: null }, { $and: [{ lockKey: { $notLike: '%|c-work|%' } }] }] },
        ]);
        expect(post).toMatchObject({ isLocked: true, title: lockedPost.title });
        expect(post.content).toBeDefined();
        expect(post.teaser).toBeUndefined();
    });

    it("serves everything to the blog's staff, asked in the site blog's scope", async () => {
        lockLife([]);
        page(lockedPost);
        const resolveViewer = vi.fn(reader('editor', true));

        const response = await handlersWith({ resolveViewer }).handleBlogPostsList(ctxFor('/posts'));
        const [post] = (await response.json()).data;

        expect(resolveViewer).toHaveBeenCalledWith(expect.anything(), { organizationId: null });
        expect(listWhere()).not.toHaveProperty('$and');
        expect(post).toMatchObject({ isLocked: true, title: lockedPost.title });
    });

    it("asks in the blog's own organization on an organization blog, never the reader's workspace", async () => {
        lockLife([]);
        const findBySlug = vi
            .spyOn(Organization, 'findBySlug')
            .mockResolvedValue({ id: 'org-1', slug: 'acme', name: 'Acme', status: 'active' } as any);
        vi.mocked(Post.where).mockResolvedValueOnce([model({ id: 'p0' })] as any); // the blog is public
        const resolveViewer = vi.fn(reader('u1'));
        await handlersWith({
            resolveViewer,
            orgBlogs: true,
            resolveEditorialScope: async () => 'org-of-the-reader',
        }).handleBlogPostsList(ctxFor('/posts?blog=acme'));

        expect(resolveViewer).toHaveBeenCalledWith(expect.anything(), { organizationId: 'org-1' });
        expect(vi.mocked(PostCategory.lockAccessFor).mock.calls[0][0]).toEqual({
            appId: 'app',
            organizationId: 'org-1',
        });
        findBySlug.mockRestore();
    });

    it('fails closed when resolving the reader throws', async () => {
        lockLife([]);
        family.add('u-mom');
        const resolveViewer = vi.fn(async () => {
            throw new Error('kv down');
        });
        await handlersWith({ resolveViewer }).handleBlogPostsList(ctxFor('/posts'));

        expect(listWhere().$and).toEqual([{ lockKey: null }]);
    });
});

describe('single post', () => {
    it('answers 404 for a closed post when teasers are off', async () => {
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

    it('never teases a closed blurb', async () => {
        lockLife(['title', 'excerpt']);
        vi.mocked(Post.first).mockResolvedValue(model({ ...lockedPost, contentType: 'blurb' }) as any);

        const response = await handlersWith().handleBlogPostBySlug(ctxFor('/posts/by-slug/a-letter'), 'a-letter');

        expect(response.status).toBe(404);
    });

    it("serves the full post to its audience's members, without the lock key", async () => {
        lockLife([]);
        family.add('u-mom');
        vi.mocked(Post.first).mockResolvedValue(model(lockedPost) as any);

        const response = await handlersWith({ resolveViewer: reader('u-mom') }).handleBlogPostBySlug(
            ctxFor('/posts/by-slug/a-letter'),
            'a-letter',
        );
        const post = await response.json();

        expect(post.isLocked).toBe(true);
        expect(post.content).toEqual(lockedPost.content);
        expect(post.lockKey).toBeUndefined();
    });

    it('does not let a password open a closed post', async () => {
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
    it('hides a closed category when teasers are off and flags it when they are on', async () => {
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

        lockLife([]);
        family.add('u-mom');
        const opened = await handlersWith({ resolveViewer: reader('u-mom') }).handleBlogCategoryBySlug(
            ctxFor('/categories/by-slug/life'),
            'life',
        );
        expect(opened.status).toBe(200);
    });

    it('hides a tag whose every post is closed to the reader (its name would describe them)', async () => {
        lockLife([]);
        vi.mocked(PostTag.findBySlug).mockResolvedValue(model({ id: 't-grief', name: 'Grief' }) as any);
        vi.mocked(PostTagLink.where).mockResolvedValue([model({ postId: 'p-life', tagId: 't-grief' })] as any);

        vi.mocked(Post.where).mockResolvedValueOnce([]);
        expect((await handlersWith().handleBlogTagBySlug(ctxFor('/tags/by-slug/grief'), 'grief')).status).toBe(404);
        expect(Post.where).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: ['p-life'], $and: [{ lockKey: null }], status: 'published' }),
            { select: ['id'], limit: 1 },
        );

        vi.mocked(Post.where).mockResolvedValueOnce([model({ id: 'p-open' })] as any);
        expect((await handlersWith().handleBlogTagBySlug(ctxFor('/tags/by-slug/grief'), 'grief')).status).toBe(200);
    });

    it('lists only the series the reader can open a post of', async () => {
        lockLife([]);
        await handlersWith().handleBlogSeriesList(ctxFor('/series'));

        expect(Post.seriesIdsOf).toHaveBeenCalledWith(
            expect.objectContaining({ $and: [{ lockKey: null }], organizationId: null }),
        );
    });

    it('builds RSS as the anonymous view, without asking who is fetching', async () => {
        lockLife([]);
        const resolveViewer = vi.fn(reader('editor', true));

        await handlersWith({ resolveViewer }).handleBlogRssFeed(ctxFor('/rss'));

        expect(resolveViewer).not.toHaveBeenCalled();
        expect(vi.mocked(Post.where).mock.calls[0][0]).toMatchObject({ $and: [{ lockKey: null }] });
    });

    it('only suggests related reading the reader can open', async () => {
        lockLife(['title']);
        vi.mocked(Post.first).mockResolvedValue(model({ ...lockedPost, id: 'p-open', lockKey: null }) as any);
        vi.mocked(PostCategoryLink.where).mockResolvedValue([]);

        await handlersWith().handleBlogRelatedPosts(ctxFor('/posts/p-open/related'), 'p-open');

        expect(vi.mocked(Post.related).mock.calls[0][1]).toMatchObject({ where: { lockKey: null } });
    });
});

describe('studio access and audiences', () => {
    const admin = async () => ({ session: { user: { id: 'admin-1' } } });
    const send = (path: string, method: string, body?: unknown) =>
        ctxFor(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const family1 = Object.assign(model({ id: 'aud-family', name: 'Family' }), {
        rename: vi.fn(),
        addMember: vi.fn(),
        removeMember: vi.fn(),
    });

    beforeEach(() => {
        vi.spyOn(User, 'whereIn').mockResolvedValue([]);
    });

    it('requires a studio admin', async () => {
        const denied = new Response('no', { status: 403 });
        const response = await handlersWith({ requireAdmin: async () => denied }).handleBlogStudioAccess(
            ctxFor('/studio/access'),
        );
        expect(response.status).toBe(403);
    });

    it("answers with the blog's teaser, locked categories with their audiences, and audiences with members", async () => {
        lockLife(['title']);
        vi.mocked(PostCategory.where).mockResolvedValue([
            model({ id: 'c-life', name: 'Life', slug: 'life', parentId: null, isLocked: true }),
            model({ id: 'c-travel', name: 'Travel', slug: 'travel', parentId: null, isLocked: false }),
        ] as any);
        vi.mocked(OttablogAudience.forBlog).mockResolvedValue([family1] as any);
        vi.mocked(OttablogCategoryAudience.where).mockResolvedValue([
            model({ categoryId: 'c-life', audienceId: 'aud-family' }),
        ] as any);
        vi.mocked(OttablogAudienceMember.where).mockResolvedValue([
            model({ audienceId: 'aud-family', userId: 'u-mom' }),
        ] as any);
        vi.mocked(User.whereIn).mockResolvedValue([
            model({ id: 'u-mom', name: 'Mom', email: 'mom@example.com', image: null }),
        ] as any);

        const state = await (
            await handlersWith({ requireAdmin: admin }).handleBlogStudioAccess(ctxFor('/studio/access'))
        ).json();

        expect(state).toEqual({
            lockedTeaser: ['title'],
            lockedCategories: [
                { id: 'c-life', name: 'Life', slug: 'life', inherited: false, audienceIds: ['aud-family'] },
            ],
            audiences: [
                {
                    id: 'aud-family',
                    name: 'Family',
                    members: [{ id: 'u-mom', name: 'Mom', email: 'mom@example.com', image: null }],
                },
            ],
        });
    });

    it('saves the teaser on the editorial blog', async () => {
        const updateLockedTeaser = vi.fn();
        vi.mocked(OttablogSettings.ensure).mockResolvedValue({ updateLockedTeaser } as any);

        const response = await handlersWith({ requireAdmin: admin }).handleBlogStudioAccess(
            send('/studio/access', 'POST', { lockedTeaser: ['title', 'excerpt'] }),
        );

        expect(response.status).toBe(200);
        expect(OttablogSettings.ensure).toHaveBeenCalledWith({ appId: 'app', organizationId: null });
        expect(updateLockedTeaser).toHaveBeenCalledWith(['title', 'excerpt']);
    });

    it('creates, renames and deletes audiences of the editorial blog only', async () => {
        const handlers = handlersWith({
            resolveEditorialScope: async () => 'org-1',
            requireScopedStudioAdmin: admin,
        });
        const blog = { appId: 'app', organizationId: 'org-1' };

        await handlers.handleBlogStudioAudienceCreate(send('/studio/audiences', 'POST', { name: 'Family' }));
        expect(OttablogAudience.createInBlog).toHaveBeenCalledWith(blog, 'Family');

        vi.mocked(OttablogAudience.findInBlog).mockResolvedValue(family1 as any);
        await handlers.handleBlogStudioAudienceUpdate(
            send('/studio/audiences/aud-family', 'PATCH', { name: 'Kin' }),
            'aud-family',
        );
        expect(OttablogAudience.findInBlog).toHaveBeenCalledWith('aud-family', blog);
        expect(family1.rename).toHaveBeenCalledWith('Kin');

        await handlers.handleBlogStudioAudienceDelete(send('/studio/audiences/aud-family', 'DELETE'), 'aud-family');
        expect(OttablogAudience.delete).toHaveBeenCalledWith('aud-family');

        // Another blog's audience does not exist here.
        vi.mocked(OttablogAudience.findInBlog).mockResolvedValue(null);
        const other = await handlers.handleBlogStudioAudienceDelete(send('/studio/audiences/x', 'DELETE'), 'x');
        expect(other.status).toBe(404);
    });

    it('turns a model validation error into a 4xx with its field errors', async () => {
        const { DomainValidationError } = await import('@ottabase/ottaorm');
        vi.mocked(OttablogAudience.createInBlog).mockRejectedValue(
            new DomainValidationError('taken', { code: 'AUDIENCE_EXISTS', fieldErrors: { name: 'taken' } }),
        );

        const response = await handlersWith({ requireAdmin: admin }).handleBlogStudioAudienceCreate(
            send('/studio/audiences', 'POST', { name: 'Family' }),
        );

        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({ code: 'AUDIENCE_EXISTS' });
    });

    it('adds any existing account by email (no organization membership needed) and removes readers', async () => {
        vi.mocked(OttablogAudience.findInBlog).mockResolvedValue(family1 as any);
        vi.spyOn(User, 'findByEmail').mockResolvedValueOnce(model({ id: 'u-mom' }) as any);
        const handlers = handlersWith({ resolveEditorialScope: () => 'org-1', requireScopedStudioAdmin: admin });

        const added = await handlers.handleBlogStudioAudienceMemberAdd(
            send('/studio/audiences/aud-family/members', 'POST', { email: ' Mom@Example.com ' }),
            'aud-family',
        );
        expect(added.status).toBe(200);
        expect(User.findByEmail).toHaveBeenCalledWith('mom@example.com');
        expect(family1.addMember).toHaveBeenCalledWith('u-mom');

        vi.spyOn(User, 'findByEmail').mockResolvedValueOnce(null);
        const unknown = await handlers.handleBlogStudioAudienceMemberAdd(
            send('/studio/audiences/aud-family/members', 'POST', { email: 'nobody@example.com' }),
            'aud-family',
        );
        expect((await unknown.json()).code).toBe('USER_NOT_FOUND');

        await handlers.handleBlogStudioAudienceMemberRemove(
            send('/studio/audiences/aud-family/members/u-mom', 'DELETE'),
            'aud-family',
            'u-mom',
        );
        expect(family1.removeMember).toHaveBeenCalledWith('u-mom');
    });

    it('gives a category of this blog audiences of this blog, and nothing else', async () => {
        const handlers = handlersWith({ requireAdmin: admin });
        const give = (audienceIds: unknown) =>
            handlers.handleBlogStudioCategoryAudiences(
                send('/studio/categories/c-life/audiences', 'PUT', { audienceIds }),
                'c-life',
            );

        vi.mocked(PostCategory.first).mockResolvedValue(null);
        expect((await give(['aud-family'])).status).toBe(404);

        vi.mocked(PostCategory.first).mockResolvedValue(model({ id: 'c-life' }) as any);
        vi.mocked(OttablogAudience.where).mockResolvedValueOnce([]);
        expect((await give(['aud-elsewhere'])).status).toBe(404);
        expect((await give('aud-family')).status).toBe(400);

        vi.mocked(OttablogAudience.where).mockResolvedValueOnce([model({ id: 'aud-family' })] as any);
        expect((await give(['aud-family', 'aud-family'])).status).toBe(200);
        expect(OttablogAudience.where).toHaveBeenLastCalledWith(
            { id: ['aud-family'], appId: 'app', organizationId: null },
            { select: ['id'] },
        );
        expect(OttablogCategoryAudience.setForCategory).toHaveBeenCalledWith('c-life', ['aud-family']);

        expect((await give([])).status).toBe(200);
        expect(OttablogCategoryAudience.setForCategory).toHaveBeenLastCalledWith('c-life', []);
    });
});
