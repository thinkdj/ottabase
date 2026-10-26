import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainValidationError, globalRLS, Organization } from '@ottabase/ottaorm';
import { buildBlogRouter, createBlogHandlers } from '../router';
import type { BlogHandlers } from '../router';
import { BlurbValidationError } from '../types';

// Model layer is mocked so handler tests can assert on query shapes without a DB.
// Router-table tests below use stub handlers and never touch these mocks.
vi.mock('../ottaorm-models', () => ({
    Post: {
        entity: 'posts',
        // The real static. List handlers read it to normalize the columns a collection read skips.
        deferred: ['content', 'footnotes', 'privateNotes'],
        first: vi.fn(async () => null),
        where: vi.fn(async () => []),
        paginate: vi.fn(async () => ({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 })),
        search: vi.fn(async () => []),
        searchPostIds: vi.fn(async () => []),
        find: vi.fn(async () => null),
        related: vi.fn(async () => []),
        publishScheduled: vi.fn(async () => ({ posts: [], hasMore: false })),
        findBySlug: vi.fn(async () => null),
        seriesIdsOf: vi.fn(async () => []),
        create: vi.fn(),
        createBlurb: vi.fn(),
        createPhotoJournal: vi.fn(),
    },
    PostCategory: {
        entity: 'categories',
        find: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        first: vi.fn(async () => null),
        where: vi.fn(async () => []),
        whereIn: vi.fn(async () => []),
        lockedIdsForScope: vi.fn(async () => new Set()),
        effectiveLockedIds: vi.fn(() => new Set()),
        create: vi.fn(),
    },
    PostCategoryLink: {
        entity: 'post_category_links',
        where: vi.fn(async () => []),
        whereIn: vi.fn(async () => []),
        create: vi.fn(),
    },
    PostSeries: {
        entity: 'series',
        find: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        first: vi.fn(async () => null),
        whereIn: vi.fn(async () => []),
        create: vi.fn(),
    },
    PostTag: {
        entity: 'post_tags',
        findBySlug: vi.fn(async () => null),
        first: vi.fn(async () => null),
        whereIn: vi.fn(async () => []),
        create: vi.fn(),
    },
    PostTagLink: {
        entity: 'post_tag_links',
        where: vi.fn(async () => []),
        whereIn: vi.fn(async () => []),
        create: vi.fn(),
    },
    OttablogSettings: {
        forBlog: vi.fn(async () => null),
        ensure: vi.fn(async () => ({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                ],
                fallbackToDefault: true,
            }),
        })),
    },
    PostTranslation: {
        forPost: vi.fn(async () => []),
        forPostSummary: vi.fn(async () => []),
        forPublicPosts: vi.fn(async () => []),
        forPublicFeed: vi.fn(async () => []),
        searchPostIds: vi.fn(async () => []),
        publishScheduled: vi.fn(async () => ({ translations: [], hasMore: false })),
        findForPost: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
        createForPost: vi.fn(),
        delete: vi.fn(),
    },
    OttablogTheme: { create: vi.fn(), findByThemeId: vi.fn(async () => null), where: vi.fn(async () => []) },
    OttablogPlugin: { create: vi.fn(), findByPluginId: vi.fn(async () => null), where: vi.fn(async () => []) },
}));

vi.mock('../studio', () => ({
    StudioManager: {
        getState: vi.fn(async () => ({ activeThemeId: null, themes: [{ themeId: 'default' }], plugins: [{}] })),
        initialize: vi.fn(async () => undefined),
    },
}));

import {
    OttablogPlugin,
    OttablogSettings,
    OttablogTheme,
    Post,
    PostCategory,
    PostCategoryLink,
    PostSeries,
    PostTag,
    PostTagLink,
    PostTranslation,
} from '../ottaorm-models';
import { StudioManager } from '../studio';

type Env = { marker: string };

const named = (name: string) => vi.fn(async () => new Response(name));

function stubHandlers(): BlogHandlers<Env> {
    return {
        handleBlogStudioState: named('studio-state'),
        handleBlogStudioBlog: named('studio-blog'),
        handleBlogStudioLanguages: named('studio-languages'),
        handleBlogStudioAccess: named('studio-access'),
        handleBlogStudioReaderGrant: named('reader-grant'),
        handleBlogStudioReaderRevoke: named('reader-revoke'),
        handleBlogPostTranslations: named('translations'),
        handleBlogPostTranslationCreate: named('translation-create'),
        handleBlogPostTranslationUpdate: named('translation-update'),
        handleBlogPostTranslationDelete: named('translation-delete'),
        handleBlogStudioActivateTheme: named('theme-activate'),
        handleBlogStudioPluginEnable: named('plugin-enable'),
        handleBlogStudioPluginConfig: named('plugin-config'),
        handleBlogPostsList: named('posts-list'),
        handleBlogBlurbCreate: named('blurb-create'),
        handleBlogBlurbUpdate: named('blurb-update'),
        handleBlogPhotoJournalCreate: named('photo-journal-create'),
        handleBlogPhotoJournalUpdate: named('photo-journal-update'),
        handleBlogPostBySlug: named('post-by-slug'),
        handleBlogPostUnlock: named('post-unlock'),
        handleBlogTagBySlug: named('tag-by-slug'),
        handleBlogCategoryBySlug: named('category-by-slug'),
        handleBlogSeriesList: named('series-list'),
        handleBlogSeriesBySlug: named('series-by-slug'),
        handleBlogAuthorById: named('author-by-id'),
        handleBlogExport: named('export'),
        handleBlogImport: named('import'),
        handleBlogRelatedPosts: named('related'),
        handleBlogRssFeed: named('rss'),
        handleBlogSitemap: named('sitemap'),
        handleBlogPublishScheduled: named('publish-scheduled'),
        handleBlogDemoSeed: named('seed-demo'),
        handleBlogPreviewTokenMint: named('preview-mint'),
        handleBlogStudioThemeTokens: named('theme-tokens'),
    };
}

const env: Env = { marker: 'env' };

const ctxFor = (path: string, init?: RequestInit) => ({
    request: new Request(`https://x.test${path}`, init),
    env,
    url: new URL(`https://x.test${path}`),
});

describe('buildBlogRouter', () => {
    it('dispatches by-slug routes with the decoded slug parameter', async () => {
        const handlers = stubHandlers();
        const router = buildBlogRouter<Env>(handlers);

        const response = await router.handle(new Request('https://x.test/posts/by-slug/hello%20world'), env);

        expect(await response!.text()).toBe('post-by-slug');
        expect(handlers.handleBlogPostBySlug).toHaveBeenCalledWith(
            expect.objectContaining({ env, url: expect.any(URL), request: expect.any(Request) }),
            'hello world',
        );
    });

    it('dispatches the full route table to the matching handlers', async () => {
        const handlers = stubHandlers();
        const router = buildBlogRouter<Env>(handlers);

        const cases: Array<[string, string, string]> = [
            ['GET', '/studio/state', 'studio-state'],
            ['GET', '/studio/blog', 'studio-blog'],
            ['POST', '/studio/languages', 'studio-languages'],
            ['GET', '/studio/access', 'studio-access'],
            ['POST', '/studio/access', 'studio-access'],
            ['POST', '/studio/access/readers', 'reader-grant'],
            ['DELETE', '/studio/access/readers/u1', 'reader-revoke'],
            ['GET', '/posts/p1/translations', 'translations'],
            ['POST', '/posts/p1/translations', 'translation-create'],
            ['PATCH', '/posts/p1/translations/fr', 'translation-update'],
            ['DELETE', '/posts/p1/translations/fr', 'translation-delete'],
            ['GET', '/rss', 'rss'],
            ['GET', '/sitemap.xml', 'sitemap'],
            ['GET', '/sitemap-index.xml', 'sitemap'],
            ['GET', '/posts', 'posts-list'],
            ['POST', '/blurbs', 'blurb-create'],
            ['PATCH', '/blurbs/p1', 'blurb-update'],
            ['POST', '/photo-journals', 'photo-journal-create'],
            ['PATCH', '/photo-journals/p1', 'photo-journal-update'],
            ['GET', '/posts/p1/related', 'related'],
            ['GET', '/tags/by-slug/t', 'tag-by-slug'],
            ['GET', '/categories/by-slug/c', 'category-by-slug'],
            ['GET', '/series', 'series-list'],
            ['GET', '/series/by-slug/s', 'series-by-slug'],
            ['GET', '/authors/u1', 'author-by-id'],
            ['GET', '/export', 'export'],
            ['POST', '/import', 'import'],
            ['POST', '/studio/theme/activate', 'theme-activate'],
            ['POST', '/studio/theme/tokens', 'theme-tokens'],
            ['POST', '/studio/plugin/enable', 'plugin-enable'],
            ['POST', '/studio/plugin/config', 'plugin-config'],
            ['POST', '/posts/unlock', 'post-unlock'],
            ['POST', '/posts/preview-token', 'preview-mint'],
            ['POST', '/publish-scheduled', 'publish-scheduled'],
            ['POST', '/seed-demo', 'seed-demo'],
        ];

        for (const [method, path, expected] of cases) {
            const response = await router.handle(new Request(`https://x.test${path}`, { method }), env);
            expect(await response!.text(), `${method} ${path}`).toBe(expected);
        }
    });

    it('resolves null for unmatched paths so composition can continue', async () => {
        const router = buildBlogRouter<Env>(stubHandlers());
        const response = await router.handle(new Request('https://x.test/not-a-blog-route'), env);
        expect(response).toBeNull();
    });

    it('exposes no seeding route other than /seed-demo', async () => {
        // Seeding writes to the app's own content, so it stays a single audited
        // entry point rather than one route per fixture.
        const router = buildBlogRouter<Env>(stubHandlers());
        const response = await router.handle(new Request('https://x.test/kitchensink', { method: 'POST' }), env);
        expect(response).toBeNull();
    });

    it('passes a custom makeContext result through to handlers', async () => {
        const handlers = stubHandlers();
        const router = buildBlogRouter<Env>(handlers, {
            makeContext: (c) => ({ request: c.req, env: c.env, url: c.url, extra: 'ctx' }) as any,
        });

        await router.handle(new Request('https://x.test/posts'), env);
        expect(handlers.handleBlogPostsList).toHaveBeenCalledWith(expect.objectContaining({ extra: 'ctx' }));
    });
});

describe('createBlogHandlers', () => {
    const baseConfig = {
        connect: vi.fn(() => null),
        defaultAppId: () => 'test-app',
        requireAdmin: vi.fn(async () => ({ session: null })),
        checkCronAuth: vi.fn(() => false),
        verifyPassword: vi.fn(async () => false),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.paginate).mockResolvedValue({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 } as any);
        vi.mocked(Post.first).mockResolvedValue(null as any);
        vi.mocked(PostTag.findBySlug).mockResolvedValue(null as any);
        vi.mocked(StudioManager.getState).mockResolvedValue({
            activeThemeId: null,
            themes: [{ themeId: 'default' }],
            plugins: [{}],
        } as any);
    });

    it('does not cache mutable language policy reads', async () => {
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [{ code: 'en', name: 'English' }],
                fallbackToDefault: true,
            }),
        } as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogStudioBlog(ctxFor('/studio/blog'));

        expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('names the editorial blog and reads its own language policy, with no fallback to another blog', async () => {
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            resolveEditorialScope: vi.fn(async () => 'org-1'),
        });
        vi.spyOn(Organization, 'find').mockResolvedValueOnce({
            get: (key: string) => ({ slug: 'acme', name: 'Acme' })[key],
        } as any);

        const response = await handlers.handleBlogStudioBlog(ctxFor('/studio/blog'));
        const body = await response.json();

        expect(body.blog).toEqual({ slug: 'acme', name: 'Acme' });
        // The organization saved nothing yet: defaults, never the site blog's languages.
        expect(body.languageConfig.supportedLanguages).toEqual([
            { code: 'en', name: 'English', nativeName: 'English' },
        ]);
        expect(OttablogSettings.forBlog).toHaveBeenCalledTimes(1);
        expect(OttablogSettings.forBlog).toHaveBeenCalledWith({ appId: 'test-app', organizationId: 'org-1' });
    });

    it('answers the editorial blog only to an editor', async () => {
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentEditor: vi.fn(async () => new Response('no', { status: 403 })),
        });

        const response = await handlers.handleBlogStudioBlog(ctxFor('/studio/blog'));

        expect(response.status).toBe(403);
        expect(OttablogSettings.forBlog).not.toHaveBeenCalled();
    });

    it('saves languages on the editorial blog, for its studio admin only', async () => {
        const requireScopedStudioAdmin = vi.fn(async () => ({ session: { user: { id: 'admin' } } }));
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            resolveEditorialScope: () => 'org-1',
            requireScopedStudioAdmin,
        });
        const updateLanguages = vi.fn();
        vi.mocked(OttablogSettings.ensure).mockResolvedValueOnce({
            updateLanguages,
            config: () => ({ defaultLanguage: 'en', supportedLanguages: [], fallbackToDefault: true }),
        } as any);

        const response = await handlers.handleBlogStudioLanguages(
            ctxFor('/studio/languages', {
                method: 'POST',
                body: JSON.stringify({ defaultLanguage: 'en', supportedLanguages: [{ code: 'en', name: 'English' }] }),
            }),
        );

        expect(response.status).toBe(200);
        expect(requireScopedStudioAdmin).toHaveBeenCalledWith(expect.anything(), { organizationId: 'org-1' });
        expect(OttablogSettings.ensure).toHaveBeenCalledWith({ appId: 'test-app', organizationId: 'org-1' });
        expect(updateLanguages).toHaveBeenCalled();
    });

    /**
     * The public shape is a contract the timeline renders against, and one a deferred column must
     * not quietly change. These assert what a reader receives, independent of how the row was read.
     */
    describe('public post payloads', () => {
        const fullPostJson = {
            id: 'p1',
            title: 'Kyoto, in the rain',
            slug: 'kyoto-in-the-rain',
            excerpt: 'A quiet blue hour.',
            blurbText: null,
            photoNote: 'A quiet blue hour.',
            photoAlbum: [{ id: 'ph1', url: 'https://images.test/1.jpg' }],
            contentType: 'photo',
            status: 'published',
            heroImage: { url: 'https://images.test/1.jpg' },
            isProtected: false,
            authorId: 'u1',
            publishedAt: 1,
            privateNotes: { blocks: [{ type: 'paragraph', data: { text: 'do not ship this' } }] },
        };
        const record = (json: Record<string, unknown> = fullPostJson) => ({
            get: (field: string) => json[field],
            toJson: () => ({ ...json }),
        });

        it('keeps every field the timeline renders and drops privateNotes from the list', async () => {
            vi.mocked(Post.paginate).mockResolvedValue({
                data: [record()],
                page: 1,
                perPage: 15,
                total: 1,
                totalPages: 1,
            } as any);
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogPostsList(ctxFor('/posts'));
            const body = (await response.json()) as { data: Record<string, unknown>[] };
            const post = body.data[0];

            // What /blog reads: excerpt for cards, blurbText for thoughts, photoAlbum for collages.
            expect(post).toMatchObject({
                id: 'p1',
                title: 'Kyoto, in the rain',
                slug: 'kyoto-in-the-rain',
                excerpt: 'A quiet blue hour.',
                photoNote: 'A quiet blue hour.',
                contentType: 'photo',
                heroImage: { url: 'https://images.test/1.jpg' },
            });
            expect(post.photoAlbum).toEqual([{ id: 'ph1', url: 'https://images.test/1.jpg' }]);
            expect('privateNotes' in post).toBe(false);
        });

        it('answers with null for the columns a collection read deferred, never a missing key', async () => {
            // A real list read never SELECTs Post.deferred, so `toJson()` has no key for them at
            // all. Left alone, /posts and /posts/by-slug would answer with different SHAPES and
            // `post.content === null` would be quietly false on one of them.
            // `record()` is already the shape a collection read produces: no body columns at all.
            vi.mocked(Post.paginate).mockResolvedValue({
                data: [record()],
                page: 1,
                perPage: 15,
                total: 1,
                totalPages: 1,
            } as any);
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogPostsList(ctxFor('/posts'));
            const post = ((await response.json()) as { data: Record<string, unknown>[] }).data[0];

            expect(post.content).toBeNull();
            expect(post.footnotes).toBeNull();
            // privateNotes is the exception: an always-null key would advertise a column that must
            // stay off public payloads entirely.
            expect('privateNotes' in post).toBe(false);
            // Everything a card actually renders is still a real value, not a null placeholder.
            expect(post.photoAlbum).toEqual([{ id: 'ph1', url: 'https://images.test/1.jpg' }]);
        });

        it('drops crossposts from a protected post along with its body', async () => {
            // A crosspost names a public copy of this very post, so leaving it on a locked payload
            // hands the reader a way around the password.
            const locked = record({
                ...fullPostJson,
                isProtected: true,
                crossposts: [{ url: 'https://www.instagram.com/p/abc' }],
            });
            vi.mocked(Post.paginate).mockResolvedValue({
                data: [locked],
                page: 1,
                perPage: 15,
                total: 1,
                totalPages: 1,
            } as any);
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogPostsList(ctxFor('/posts'));
            const body = (await response.json()) as { data: Record<string, unknown>[] };

            expect(body.data[0].crossposts).toBeNull();
            expect(body.data[0].photoAlbum).toBeNull();
            expect(body.data[0].content).toBeNull();
        });

        it('drops privateNotes from a single public post too', async () => {
            vi.mocked(Post.first).mockResolvedValue(record() as any);
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogPostBySlug(
                ctxFor('/posts/by-slug/kyoto-in-the-rain'),
                'kyoto-in-the-rain',
            );
            const post = (await response.json()) as Record<string, unknown>;

            expect(post.slug).toBe('kyoto-in-the-rain');
            expect('privateNotes' in post).toBe(false);
        });

        it('exposes only id, name, and image for an author — never the account email', async () => {
            const { User } = await import('@ottabase/ottaorm');
            const author = {
                get: (field: string) =>
                    ({ id: 'u1', name: 'Deepak', image: 'https://images.test/a.jpg' })[field as string],
            };
            const whereIn = vi.spyOn(User, 'whereIn').mockResolvedValue([author] as any);
            vi.mocked(Post.paginate).mockResolvedValue({
                data: [record()],
                page: 1,
                perPage: 15,
                total: 1,
                totalPages: 1,
            } as any);
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogPostsList(ctxFor('/posts'));
            const body = (await response.json()) as { data: { author: Record<string, unknown> }[] };

            // The email never leaves D1: the allowlist is applied in the SELECT, not after it.
            expect(whereIn).toHaveBeenCalledWith('id', ['u1'], { select: ['id', 'name', 'image'] });
            expect(Object.keys(body.data[0].author).sort()).toEqual(['id', 'image', 'name']);
            whereIn.mockRestore();
        });
    });

    it('publish-scheduled rejects with 401 before touching the database when cron auth fails', async () => {
        const connect = vi.fn(() => null);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, connect, checkCronAuth: () => false });

        const response = await handlers.handleBlogPublishScheduled(ctxFor('/publish-scheduled', { method: 'POST' }));

        expect(response.status).toBe(401);
        expect(connect).not.toHaveBeenCalled();
    });

    it('publish-scheduled returns the bounded batch and continuation signal', async () => {
        vi.mocked(Post.publishScheduled).mockResolvedValueOnce({
            posts: [{ id: 'p1', title: 'Due now', slug: 'due-now' }],
            hasMore: true,
        });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, checkCronAuth: () => true });

        const response = await handlers.handleBlogPublishScheduled(
            ctxFor('/publish-scheduled?appId=test-app', { method: 'POST' }),
        );

        await expect(response.json()).resolves.toMatchObject({
            published: 1,
            posts: [{ id: 'p1', title: 'Due now', slug: 'due-now' }],
            hasMore: true,
        });
        expect(Post.publishScheduled).toHaveBeenCalledWith({ appId: 'test-app' });
        expect(PostTranslation.publishScheduled).toHaveBeenCalledWith({ appId: 'test-app' });
    });

    it('requires publish permission to demote an already-published translation', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:update'],
        };
        const post = {
            get: (field: string) => ({ id: 'p1', appId: 'test-app', organizationId: 'org-1', language: 'en' })[field],
        };
        const stored = {
            id: 't1',
            postId: 'p1',
            language: 'ml',
            status: 'published',
            title: 'Malayalam title',
            slug: 'malayalam-title',
        };
        const translation = {
            get: (field: string) => (stored as Record<string, unknown>)[field],
            toJson: () => stored,
            updateContent: vi.fn(),
        };
        vi.mocked(Post.first).mockResolvedValueOnce(post as any);
        vi.mocked(PostTranslation.findForPost).mockResolvedValueOnce(translation as any);
        const getReadFilter = vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: 'org-1' });
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentEditor: async () => ({ session: { user: { id: 'u1' } }, securityContext }),
        });

        const response = await handlers.handleBlogPostTranslationUpdate(
            ctxFor('/posts/p1/translations/ml', { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) }),
            'p1',
            'ml',
        );

        expect(response.status).toBe(403);
        expect(translation.updateContent).not.toHaveBeenCalled();
        getReadFilter.mockRestore();
    });

    it.each([
        ['published', false, 403],
        ['scheduled', false, 403],
        ['draft', false, 200],
        ['published', true, 200],
        ['scheduled', true, 200],
    ] as const)('checks deletion of %s translation (publisher: %s)', async (status, publisher, expectedStatus) => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: publisher ? ['posts:update', 'posts:publish'] : ['posts:update'],
        };
        const post = {
            get: (field: string) => ({ id: 'p1', appId: 'test-app', organizationId: 'org-1', language: 'en' })[field],
        };
        vi.mocked(Post.first).mockResolvedValueOnce(post as any);
        vi.mocked(PostTranslation.findForPost).mockResolvedValueOnce({
            get: (field: string) => (field === 'status' ? status : 't1'),
        } as any);
        const filter = vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: 'org-1' });
        try {
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                requireContentEditor: async () => ({ session: { user: { id: 'u1' } }, securityContext }),
            });
            const response = await handlers.handleBlogPostTranslationDelete(
                ctxFor('/posts/p1/translations/ml', { method: 'DELETE' }),
                'p1',
                'ml',
            );
            expect(response.status).toBe(expectedStatus);
            expect(PostTranslation.delete).toHaveBeenCalledTimes(expectedStatus === 200 ? 1 : 0);
        } finally {
            filter.mockRestore();
        }
    });

    it('maps invalid translation writes to a validation response instead of a 500', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:update'],
        };
        const post = {
            get: (field: string) => ({ id: 'p1', appId: 'test-app', organizationId: 'org-1', language: 'en' })[field],
        };
        vi.mocked(Post.first).mockResolvedValueOnce(post as any);
        vi.mocked(PostTranslation.createForPost).mockRejectedValueOnce(
            new DomainValidationError('Translation title is invalid', { status: 422 }),
        );
        const getReadFilter = vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: 'org-1' });
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentEditor: async () => ({ session: { user: { id: 'u1' } }, securityContext }),
        });

        const response = await handlers.handleBlogPostTranslationCreate(
            ctxFor('/posts/p1/translations', { method: 'POST', body: JSON.stringify({ language: 'ml', title: 'x' }) }),
            'p1',
        );

        expect(response.status).toBe(422);
        expect((await response.json()).code).toBe('VALIDATION_ERROR');
        getReadFilter.mockRestore();
    });

    it('returns translation metadata in the list and full content only for the selected language', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: null,
            appId: 'test-app',
            permissions: ['posts:read'],
            platformAdmin: true,
        };
        const post = {
            get: (field: string) => ({ id: 'p1', appId: 'test-app', language: 'en' })[field],
        };
        const summary = {
            toSummaryJson: () => ({
                id: 't1',
                postId: 'p1',
                language: 'ml',
                title: 'Malayalam title',
                slug: 'namaskaram',
                status: 'draft',
                publishAt: null,
                publishedAt: null,
                updatedAt: 123,
            }),
        };
        const full = {
            toJson: () => ({
                id: 't1',
                postId: 'p1',
                language: 'ml',
                title: 'Malayalam title',
                slug: 'namaskaram',
                content: { blocks: [{ type: 'paragraph', data: { text: 'Full body' } }] },
            }),
        };
        vi.mocked(Post.first)
            .mockResolvedValueOnce(post as any)
            .mockResolvedValueOnce(post as any);
        vi.mocked(PostTranslation.forPostSummary).mockResolvedValueOnce([summary] as any);
        vi.mocked(PostTranslation.findForPost).mockResolvedValueOnce(full as any);
        const getReadFilter = vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: null });
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentEditor: async () => ({ session: { user: { id: 'u1' } }, securityContext }),
        });

        const listResponse = await handlers.handleBlogPostTranslations(ctxFor('/posts/p1/translations'), 'p1');
        expect((await listResponse.json()).translations).toEqual([expect.objectContaining({ slug: 'namaskaram' })]);
        expect(PostTranslation.forPostSummary).toHaveBeenCalledWith('p1');
        expect(PostTranslation.forPost).not.toHaveBeenCalled();

        const detailResponse = await handlers.handleBlogPostTranslations(
            ctxFor('/posts/p1/translations?language=ml'),
            'p1',
        );
        expect((await detailResponse.json()).translations).toEqual([
            expect.objectContaining({ content: expect.any(Object) }),
        ]);
        expect(PostTranslation.findForPost).toHaveBeenCalledWith('p1', 'ml');
        getReadFilter.mockRestore();
    });

    it('publishes every published translation variant in the sitemap and varies the public cache', async () => {
        const post = {
            get: (field: string) =>
                ({
                    id: 'p1',
                    slug: 'hello',
                    language: 'en',
                    contentType: 'blog',
                    updatedAt: new Date('2026-01-01T00:00:00Z'),
                })[field],
        };
        const translation = {
            get: (field: string) =>
                ({
                    id: 't1',
                    postId: 'p1',
                    language: 'ml',
                    slug: 'namaskaram',
                    title: 'Namaskaram',
                })[field],
        };
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                ],
                fallbackToDefault: true,
            }),
        } as any);
        vi.mocked(Post.where).mockResolvedValueOnce([post] as any);
        vi.mocked(PostTranslation.forPublicPosts).mockResolvedValueOnce([translation] as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        const response = await handlers.handleBlogSitemap(ctxFor('/sitemap.xml'));

        const body = await response.text();
        expect(response.headers.get('Vary')).toContain('Accept-Language');
        expect(body).toContain('/blog/hello');
        expect(body).toContain('/blog/namaskaram?lang=ml');
        expect(body).toContain('hreflang="ml"');
        expect(PostTranslation.forPublicPosts).toHaveBeenCalledWith(['p1']);
    });

    it('honors Accept-Language quality weights when selecting a supported locale', async () => {
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                    { code: 'de', name: 'German' },
                ],
                fallbackToDefault: true,
            }),
        } as any);
        const post = {
            get: (field: string) => ({ id: 'p1', appId: 'test-app', slug: 'hello', language: 'en' })[field],
            toJson: () => ({
                id: 'p1',
                appId: 'test-app',
                slug: 'hello',
                language: 'en',
                title: 'Hello',
                status: 'published',
            }),
        };
        vi.mocked(Post.first).mockResolvedValueOnce(post as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        const response = await handlers.handleBlogPostBySlug(
            {
                ...ctxFor('/posts/by-slug/hello', { headers: { 'Accept-Language': 'de;q=0.2,en;q=1' } }),
                url: new URL('https://x.test/posts/by-slug/hello'),
            },
            'hello',
        );
        expect(response.status).toBe(200);
        expect((await response.json()).language).toBe('en');
        expect(PostTranslation.findBySlug).toHaveBeenCalledWith('hello', expect.objectContaining({ language: 'en' }));
    });

    it('resolves a translated slug directly without requiring a lang query parameter', async () => {
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                ],
                fallbackToDefault: true,
            }),
        } as any);
        const translation = {
            get: (field: string) => ({ id: 't1', postId: 'p1', language: 'ml', slug: 'dry-season-idris-ml' })[field],
            toJson: () => ({
                id: 't1',
                postId: 'p1',
                language: 'ml',
                slug: 'dry-season-idris-ml',
                title: 'Dry Season Idris',
            }),
        };
        const post = {
            get: (field: string) =>
                ({ id: 'p1', appId: 'test-app', slug: 'dry-season-idris', language: 'en', status: 'published' })[field],
            toJson: () => ({
                id: 'p1',
                appId: 'test-app',
                slug: 'dry-season-idris',
                language: 'en',
                title: 'Dry Season Idris',
                status: 'published',
            }),
        };
        vi.mocked(PostTranslation.findBySlug).mockResolvedValueOnce(translation as any);
        vi.mocked(Post.first).mockResolvedValueOnce(post as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogPostBySlug(
            ctxFor('/posts/by-slug/dry-season-idris-ml'),
            'dry-season-idris-ml',
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            slug: 'dry-season-idris-ml',
            language: 'ml',
            baseSlug: 'dry-season-idris',
        });
        expect(PostTranslation.findBySlug).toHaveBeenCalledWith('dry-season-idris-ml', {
            appId: 'test-app',
            organizationId: null,
            status: 'published',
        });
    });

    it('searches localized fields and keeps the list projection bounded to matching post ids', async () => {
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                ],
                fallbackToDefault: true,
            }),
        } as any);
        vi.mocked(PostTranslation.searchPostIds).mockResolvedValueOnce(['p1']);
        vi.mocked(Post.paginate).mockResolvedValueOnce({
            data: [],
            page: 1,
            perPage: 15,
            total: 0,
            totalPages: 0,
        } as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        await handlers.handleBlogPostsList(ctxFor('/posts?lang=ml&search=മഴ'));
        expect(PostTranslation.searchPostIds).toHaveBeenCalledWith(
            'മഴ',
            expect.objectContaining({ language: 'ml', status: 'published' }),
        );
        expect(Post.paginate).toHaveBeenCalledWith(1, 15, expect.objectContaining({ id: ['p1'] }), expect.any(Object));
    });

    it('uses each post canonical language, excludes disabled translations, and caps sitemap URL entries', async () => {
        const post = {
            get: (field: string) =>
                ({
                    id: 'p1',
                    slug: 'hello',
                    language: 'ml',
                    contentType: 'blog',
                    updatedAt: new Date('2026-01-01T00:00:00Z'),
                })[field],
        };
        const enabledDefaultTranslation = {
            get: (field: string) => ({ id: 't1', postId: 'p1', language: 'en', slug: 'hello-en' })[field],
        };
        const disabledTranslation = {
            get: (field: string) => ({ id: 't2', postId: 'p1', language: 'fr', slug: 'bonjour' })[field],
        };
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                ],
                fallbackToDefault: true,
            }),
        } as any);
        vi.mocked(Post.where).mockResolvedValueOnce([post] as any);
        vi.mocked(PostTranslation.forPublicPosts).mockResolvedValueOnce([
            enabledDefaultTranslation,
            disabledTranslation,
        ] as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        const response = await handlers.handleBlogSitemap(ctxFor('/sitemap.xml?limit=2'));
        const body = await response.text();
        expect((body.match(/<url>/g) ?? []).length).toBe(2);
        expect(body).toContain('/blog/hello</loc>');
        expect(body).toContain('/blog/hello-en?lang=en');
        expect(body).not.toContain('bonjour');
        expect(response.headers.get('X-Sitemap-Truncated')).toBe('true');
        expect(body).toContain('hreflang="ml"');
    });

    it('publishes a discoverable sitemap index for paginated URL files', async () => {
        vi.mocked(Post.paginate).mockResolvedValueOnce({
            data: [],
            page: 1,
            perPage: 20,
            total: 41,
            totalPages: 3,
        } as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        const response = await handlers.handleBlogSitemap(ctxFor('/sitemap-index.xml'));
        const body = await response.text();

        expect(response.headers.get('Content-Type')).toContain('application/xml');
        expect(body).toContain('<sitemapindex');
        expect(body).toContain('/api/blog/sitemap.xml?page=1');
        expect(body).toContain('/api/blog/sitemap.xml?page=3');
    });
    it('seed-demo responds 404 when no demo content is configured', async () => {
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        const response = await handlers.handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));
        expect(response.status).toBe(404);
    });

    it('seed-demo returns the admin denial response untouched', async () => {
        const denial = new Response('nope', { status: 403 });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireAdmin: async () => denial });

        const response = await handlers.handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));
        expect(response).toBe(denial);
    });

    it('propagates the connect error response from data routes', async () => {
        const dbError = new Response('no d1', { status: 500 });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, connect: () => dbError });

        const response = await handlers.handleBlogPostsList(ctxFor('/posts'));
        expect(response).toBe(dbError);
    });

    it('creates blurbs through the create-grade guard and fat model', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:create', 'posts:publish'],
        };
        const requireContentCreator = vi.fn(async () => ({
            session: { user: { id: 'u1', organizationId: 'org-1' } },
            securityContext,
        }));
        const created = { toJson: () => ({ id: 'b1', contentType: 'blurb', blurbText: 'A quick thought' }) };
        vi.mocked(Post.createBlurb).mockResolvedValueOnce(created as any);
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentCreator });

        const response = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text: 'A quick thought' }),
            }),
        );

        expect(response.status).toBe(201);
        expect(requireContentCreator).toHaveBeenCalled();
        expect(validateWrite).toHaveBeenCalledWith(
            'posts',
            securityContext,
            expect.objectContaining({ organizationId: 'org-1', userId: 'u1', appId: 'test-app' }),
            'create',
        );
        // A body with no status must NOT self-publish to the public timeline and RSS.
        expect(Post.createBlurb).toHaveBeenCalledWith(
            'A quick thought',
            expect.objectContaining({ status: 'draft', organizationId: 'org-1', userId: 'u1' }),
        );
        validateWrite.mockRestore();
    });

    it('publishes a blurb only when the request asks for it', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:create', 'posts:publish'],
        };
        const requireContentCreator = vi.fn(async () => ({
            session: { user: { id: 'u1', organizationId: 'org-1' } },
            securityContext,
        }));
        vi.mocked(Post.createBlurb).mockResolvedValueOnce({ toJson: () => ({ id: 'b2' }) } as any);
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentCreator });

        const response = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text: 'A quick thought', status: 'published' }),
            }),
        );

        expect(response.status).toBe(201);
        expect(Post.createBlurb).toHaveBeenCalledWith(
            'A quick thought',
            expect.objectContaining({ status: 'published' }),
        );
        validateWrite.mockRestore();
    });

    it('passes crossposts to the model on create and reports a bad link as a 400', async () => {
        const requireContentCreator = vi.fn(async () => ({
            session: { user: { id: 'u1', organizationId: 'org-1' } },
            securityContext: { userId: 'u1', organizationId: 'org-1', appId: 'test-app' },
        }));
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentCreator });
        const crossposts = [{ url: 'https://www.instagram.com/p/abc', origin: true }, 'https://x.com/me/status/1'];

        vi.mocked(Post.createBlurb).mockResolvedValueOnce({ toJson: () => ({ id: 'b3' }) } as any);
        const ok = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', { method: 'POST', body: JSON.stringify({ text: 'Cross-posted', crossposts }) }),
        );

        expect(ok.status).toBe(201);
        expect(Post.createBlurb).toHaveBeenCalledWith('Cross-posted', expect.objectContaining({ crossposts }));

        // The model owns the URL rules, so a bad link surfaces the same way empty text does.
        vi.mocked(Post.createBlurb).mockRejectedValueOnce(new BlurbValidationError('not a full http(s) link'));
        const bad = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', {
                method: 'POST',
                body: JSON.stringify({ text: 'Cross-posted', crossposts: ['javascript:alert(1)'] }),
            }),
        );

        expect(bad.status).toBe(400);
        validateWrite.mockRestore();
    });

    it('returns validation errors for empty blurbs without invoking the model', async () => {
        const requireContentCreator = vi.fn(async () => ({
            session: { user: { id: 'u1', organizationId: 'org-1' } },
            securityContext: { userId: 'u1', organizationId: 'org-1', appId: 'test-app' },
        }));
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        vi.mocked(Post.createBlurb).mockRejectedValueOnce(new BlurbValidationError('Blurb text is required'));
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentCreator });

        const response = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', { method: 'POST', body: JSON.stringify({ text: ' ', status: 'draft' }) }),
        );

        expect(response.status).toBe(400);
        validateWrite.mockRestore();
    });

    it('creates photo journals through the fat model with server-derived ownership', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:create', 'posts:publish'],
        };
        const requireContentCreator = vi.fn(async () => ({
            session: { user: { id: 'u1', organizationId: 'org-1' } },
            securityContext,
        }));
        const photos = [{ id: 'm1', mediaId: 'm1', url: 'https://images.test/kyoto.jpg' }];
        const created = { toJson: () => ({ id: 'p1', contentType: 'photo', photoAlbum: photos }) };
        vi.mocked(Post.createPhotoJournal).mockResolvedValueOnce(created as any);
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentCreator });

        const response = await handlers.handleBlogPhotoJournalCreate(
            ctxFor('/photo-journals', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    title: 'Kyoto, in the rain',
                    note: 'A wet blue hour.',
                    photos,
                    status: 'draft',
                }),
            }),
        );

        expect(response.status).toBe(201);
        expect(Post.createPhotoJournal).toHaveBeenCalledWith(
            photos,
            expect.objectContaining({
                title: 'Kyoto, in the rain',
                note: 'A wet blue hour.',
                status: 'draft',
                organizationId: 'org-1',
                userId: 'u1',
                appId: 'test-app',
            }),
        );
        expect(validateWrite).toHaveBeenCalledWith(
            'posts',
            securityContext,
            expect.objectContaining({ contentType: 'photo', organizationId: 'org-1' }),
            'create',
        );
        validateWrite.mockRestore();
    });

    it('creates platform-owned blurbs and photo journals from a canonical platform context', async () => {
        const securityContext = {
            userId: 'owner-1',
            organizationId: null,
            appId: 'test-app',
            permissions: ['*:*'],
            platformAdmin: true,
            memberOrganizationIds: [],
        };
        const requireContentCreator = vi.fn(async () => ({
            session: { user: { id: 'owner-1', organizationId: null, platformAdmin: true } },
            securityContext,
        }));
        const photos = [{ id: 'm1', mediaId: 'm1', url: 'https://images.test/kyoto.jpg' }];
        vi.mocked(Post.createBlurb).mockResolvedValueOnce({
            toJson: () => ({ id: 'b-platform', contentType: 'blurb' }),
        } as any);
        vi.mocked(Post.createPhotoJournal).mockResolvedValueOnce({
            toJson: () => ({ id: 'p-platform', contentType: 'photo' }),
        } as any);
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentCreator });

        const blurbResponse = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text: 'A platform thought' }),
            }),
        );
        const photoResponse = await handlers.handleBlogPhotoJournalCreate(
            ctxFor('/photo-journals', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ photos, status: 'draft' }),
            }),
        );

        expect(blurbResponse.status).toBe(201);
        expect(photoResponse.status).toBe(201);
        expect(Post.createBlurb).toHaveBeenCalledWith(
            'A platform thought',
            expect.objectContaining({ organizationId: null, userId: 'owner-1', appId: 'test-app' }),
        );
        expect(Post.createPhotoJournal).toHaveBeenCalledWith(
            photos,
            expect.objectContaining({ organizationId: null, userId: 'owner-1', appId: 'test-app' }),
        );
        expect(validateWrite).toHaveBeenCalledTimes(2);
        expect(validateWrite).toHaveBeenCalledWith(
            'posts',
            securityContext,
            expect.objectContaining({ contentType: 'blurb', organizationId: null }),
            'create',
        );
        expect(validateWrite).toHaveBeenCalledWith(
            'posts',
            securityContext,
            expect.objectContaining({ contentType: 'photo', organizationId: null }),
            'create',
        );
        validateWrite.mockRestore();
    });

    it('rejects a photo-journal write without an organization or platform authority', async () => {
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentCreator: async () => ({
                session: { user: { id: 'u1', organizationId: null } },
                securityContext: {
                    userId: 'u1',
                    organizationId: null,
                    appId: 'test-app',
                    permissions: ['posts:create'],
                    platformAdmin: false,
                    memberOrganizationIds: [],
                },
            }),
        });

        const response = await handlers.handleBlogPhotoJournalCreate(
            ctxFor('/photo-journals', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    photos: [{ id: 'm1', mediaId: 'm1', url: 'https://images.test/kyoto.jpg' }],
                    status: 'draft',
                }),
            }),
        );

        expect(response.status).toBe(403);
        expect(Post.createPhotoJournal).not.toHaveBeenCalled();
        expect(validateWrite).not.toHaveBeenCalled();
        validateWrite.mockRestore();
    });

    it('keeps publishing separate from create permission', async () => {
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentCreator: async () => ({
                session: { user: { id: 'u1', organizationId: 'org-1' } },
                securityContext: {
                    userId: 'u1',
                    organizationId: 'org-1',
                    appId: 'test-app',
                    permissions: ['posts:create'],
                },
            }),
        });

        const response = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', { method: 'POST', body: JSON.stringify({ text: 'Cannot publish this' }) }),
        );

        expect(response.status).toBe(403);
        expect(Post.createBlurb).not.toHaveBeenCalled();
    });

    it('updates only a blurb visible through the caller RLS filter', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:update', 'posts:publish'],
        };
        const updated = { id: 'b1', contentType: 'blurb', blurbText: 'Revised thought' };
        const record = {
            get: (field: string) => (field === 'status' ? 'draft' : undefined),
            toJson: () => ({ id: 'b1', organizationId: 'org-1', userId: 'u1', contentType: 'blurb' }),
            updateBlurb: vi.fn(async () => ({ toJson: () => updated })),
        };
        vi.mocked(Post.first).mockResolvedValueOnce(record as any);
        const getReadFilter = vi
            .spyOn(globalRLS, 'getReadFilter')
            .mockReturnValue({ organizationId: 'org-1', userId: 'u1' });
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentEditor: async () => ({
                session: { user: { id: 'u1', organizationId: 'org-1' } },
                securityContext,
            }),
        });

        const response = await handlers.handleBlogBlurbUpdate(
            ctxFor('/blurbs/b1', {
                method: 'PATCH',
                body: JSON.stringify({ text: 'Revised thought', status: 'published' }),
            }),
            'b1',
        );

        expect(response.status).toBe(200);
        expect(Post.first).toHaveBeenCalledWith({
            id: 'b1',
            contentType: 'blurb',
            organizationId: 'org-1',
            userId: 'u1',
        });
        expect(validateWrite).toHaveBeenCalledWith('posts', securityContext, record.toJson(), 'update');
        expect(record.updateBlurb).toHaveBeenCalledWith(
            'Revised thought',
            expect.objectContaining({ status: 'published' }),
        );
        expect(await response.json()).toEqual(updated);
        getReadFilter.mockRestore();
        validateWrite.mockRestore();
    });

    it('reports an unconfigured editorial guard as a host config error, never as a 401', async () => {
        // baseConfig wires requireAdmin only — which carries no securityContext. Falling back to it
        // would fail later with "Authentication required", blaming the user for a deployment gap.
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogBlurbCreate(
            ctxFor('/blurbs', { method: 'POST', body: JSON.stringify({ text: 'hi' }) }),
        );

        expect(response.status).toBe(500);
        expect((await response.json()).code).toBe('CONFIG_ERROR');
        expect(baseConfig.requireAdmin).not.toHaveBeenCalled();
        expect(Post.createBlurb).not.toHaveBeenCalled();
    });

    it('treats an omitted body field as unchanged on a status-only PATCH', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:update', 'posts:publish'],
        };
        const stored: Record<string, unknown> = {
            id: 'b1',
            contentType: 'blurb',
            blurbText: 'Stored thought',
            photoAlbum: [{ id: 'p1', url: 'https://images.test/one.jpg' }],
        };
        const record = {
            get: (field: string) => stored[field],
            toJson: () => stored,
            updateBlurb: vi.fn(async () => ({ toJson: () => stored })),
            updatePhotoJournal: vi.fn(async () => ({ toJson: () => stored })),
        };
        vi.mocked(Post.first).mockResolvedValue(record as any);
        const getReadFilter = vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: 'org-1' });
        const validateWrite = vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        const auth = async () => ({ session: { user: { id: 'u1', organizationId: 'org-1' } }, securityContext });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireContentEditor: auth });

        const blurbResponse = await handlers.handleBlogBlurbUpdate(
            ctxFor('/blurbs/b1', { method: 'PATCH', body: JSON.stringify({ status: 'published' }) }),
            'b1',
        );
        const photoResponse = await handlers.handleBlogPhotoJournalUpdate(
            ctxFor('/photo-journals/b1', { method: 'PATCH', body: JSON.stringify({ status: 'published' }) }),
            'b1',
        );

        expect(blurbResponse.status).toBe(200);
        expect(photoResponse.status).toBe(200);
        expect(record.updateBlurb).toHaveBeenCalledWith(
            'Stored thought',
            expect.objectContaining({ status: 'published' }),
        );
        expect(record.updatePhotoJournal).toHaveBeenCalledWith(
            stored.photoAlbum,
            expect.objectContaining({ status: 'published' }),
        );
        getReadFilter.mockRestore();
        validateWrite.mockRestore();
    });

    it('requires publish permission when a PATCH targets an already public subtype', async () => {
        const securityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
            permissions: ['posts:update'],
        };
        const stored: Record<string, unknown> = {
            id: 'public-1',
            status: 'published',
            contentType: 'blurb',
            blurbText: 'Public thought',
            photoAlbum: [{ id: 'p1', url: 'https://images.test/one.jpg' }],
        };
        const record = {
            get: (field: string) => stored[field],
            toJson: () => stored,
            updateBlurb: vi.fn(),
            updatePhotoJournal: vi.fn(),
        };
        vi.mocked(Post.first).mockResolvedValue(record as any);
        const getReadFilter = vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: 'org-1' });
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireContentEditor: async () => ({
                session: { user: { id: 'u1', organizationId: 'org-1' } },
                securityContext,
            }),
        });

        const blurbResponse = await handlers.handleBlogBlurbUpdate(
            ctxFor('/blurbs/public-1', { method: 'PATCH', body: JSON.stringify({ text: 'Changed' }) }),
            'public-1',
        );
        const photoResponse = await handlers.handleBlogPhotoJournalUpdate(
            ctxFor('/photo-journals/public-1', { method: 'PATCH', body: JSON.stringify({ note: 'Changed' }) }),
            'public-1',
        );

        expect(blurbResponse.status).toBe(403);
        expect(photoResponse.status).toBe(403);
        expect((await blurbResponse.json()).error).toBe('Access denied');
        expect((await photoResponse.json()).error).toBe('Access denied');
        expect(record.updateBlurb).not.toHaveBeenCalled();
        expect(record.updatePhotoJournal).not.toHaveBeenCalled();
        getReadFilter.mockRestore();
    });

    it('projects public author data without exposing the account email', async () => {
        const authorFields = {
            id: 'author-1',
            name: 'Ada',
            email: 'private-login@example.com',
            image: '/ada.png',
        };
        const postFields = {
            id: 'post-1',
            slug: 'public-post',
            title: 'Public post',
            status: 'published',
            contentType: 'blog',
            authorId: 'author-1',
            isProtected: false,
        };
        const author = {
            get: (field: string) => authorFields[field as keyof typeof authorFields],
        };
        const record = {
            get: (field: string) => postFields[field as keyof typeof postFields] ?? null,
            toJson: () => ({ ...postFields, privateNotes: 'never public' }),
            author: vi.fn(async () => author),
            tags: vi.fn(async () => []),
        };
        vi.mocked(Post.first).mockResolvedValueOnce(record as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/public-post'), 'public-post');
        const body = (await response.json()) as {
            author?: Record<string, unknown>;
            privateNotes?: unknown;
        };

        expect(response.status).toBe(200);
        expect(record.author).toHaveBeenCalledWith(['id', 'name', 'image']);
        expect(body.author).toEqual({
            id: 'author-1',
            name: 'Ada',
            image: '/ada.png',
        });
        expect(body.author).not.toHaveProperty('email');
        expect(body).not.toHaveProperty('privateNotes');
    });

    it('withholds every body column of a locked protected post, not just the article content', async () => {
        const postFields = {
            id: 'post-2',
            slug: 'locked',
            title: 'Locked',
            excerpt: 'Teaser stays public',
            status: 'published',
            contentType: 'photo',
            isProtected: true,
            content: { blocks: [{ type: 'paragraph' }] },
            footnotes: { blocks: [] },
            blurbText: 'secret thought',
            photoNote: 'secret note',
            photoAlbum: [{ id: 'p1', url: 'https://images.test/secret.jpg' }],
            meta: { pluginSecret: 'do not ship' },
        };
        const record = {
            get: (field: string) => postFields[field as keyof typeof postFields] ?? null,
            toJson: () => ({ ...postFields }),
            author: vi.fn(async () => null),
            tags: vi.fn(async () => []),
        };
        vi.mocked(Post.first).mockResolvedValueOnce(record as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/locked'), 'locked');
        const body = (await response.json()) as Record<string, unknown>;

        expect(body.content).toBeNull();
        expect(body.footnotes).toBeNull();
        expect(body.blurbText).toBeNull();
        expect(body.photoNote).toBeNull();
        expect(body.photoAlbum).toBeNull();
        expect(body.meta).toBeNull();
        // The lock screen still needs something to show.
        expect(body.title).toBe('Locked');
        expect(body.excerpt).toBe('Teaser stays public');
    });

    it('includes an older canonical parent when its localized translation is newly published', async () => {
        const recent = {
            get: (field: string) =>
                ({ id: 'recent', slug: 'recent', language: 'en', contentType: 'blog', publishedAt: 1_000 })[field],
            toJson: () => ({ id: 'recent', slug: 'recent', language: 'en', contentType: 'blog', publishedAt: 1_000 }),
        };
        const older = {
            get: (field: string) =>
                ({ id: 'older', slug: 'older', language: 'en', contentType: 'blog', publishedAt: 100 })[field],
            toJson: () => ({ id: 'older', slug: 'older', language: 'en', contentType: 'blog', publishedAt: 100 }),
        };
        const translation = {
            get: (field: string) =>
                ({
                    id: 't-old',
                    postId: 'older',
                    language: 'ml',
                    slug: 'purono',
                    title: 'പഴയ ലേഖനം',
                    excerpt: 'വിവരണം',
                    publishedAt: 2_000,
                    status: 'published',
                })[field],
        };
        (translation as any).toPublicListJson = () => ({
            id: 't-old',
            postId: 'older',
            language: 'ml',
            slug: 'purono',
            title: 'പഴയ ലേഖനം',
            excerpt: 'വിവരണം',
            publishedAt: 2_000,
            status: 'published',
        });
        vi.mocked(Post.where)
            .mockResolvedValueOnce([recent] as any)
            .mockResolvedValueOnce([older] as any);
        vi.mocked(OttablogSettings.forBlog).mockResolvedValueOnce({
            config: () => ({
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                ],
                fallbackToDefault: true,
            }),
        } as any);
        vi.mocked(PostTranslation.forPublicFeed).mockResolvedValueOnce([translation] as any);
        vi.mocked(PostTranslation.forPublicPosts).mockResolvedValueOnce([translation] as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogRssFeed(ctxFor('/rss?lang=ml'));
        const xml = await response.text();

        expect(PostTranslation.forPublicFeed).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'ml', limit: 25 }),
        );
        expect(xml).toContain('/blog/purono?lang=ml');
        expect(xml).toContain('പഴയ ലേഖനം');
    });
    it('publishes photo journals to RSS with a lead-image enclosure and category', async () => {
        const fields = {
            id: 'photo-1',
            title: 'Kyoto, in the rain',
            slug: 'kyoto-rain',
            excerpt: 'A quiet blue hour.',
            contentType: 'photo',
            authorId: null,
            publishedAt: 1_700_000_000_000,
            heroImage: { url: 'https://images.test/kyoto.png', mimeType: 'image/png' },
        };
        vi.mocked(Post.where).mockResolvedValueOnce([
            { get: (field: string) => fields[field as keyof typeof fields] ?? null },
        ] as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogRssFeed(ctxFor('/rss'));
        const xml = await response.text();

        expect(response.headers.get('Content-Type')).toContain('application/rss+xml');
        expect(xml).toContain('<category>Photo Journal</category>');
        expect(xml).toContain('<description>A quiet blue hour.</description>');
        expect(xml).toContain('<enclosure url="https://images.test/kyoto.png" type="image/png" />');
    });

    describe('site blog (default)', () => {
        it('reads the site blog when no ?blog= is given, never the editorial scope', async () => {
            const resolveEditorialScope = vi.fn(async () => 'org-1');
            const handlers = createBlogHandlers<Env>({ ...baseConfig, resolveEditorialScope });

            await handlers.handleBlogPostsList(ctxFor('/posts'));

            // A visitor's own workspace never picks the blog they read.
            expect(resolveEditorialScope).not.toHaveBeenCalled();
            const where = vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;
            expect(where).toMatchObject({ appId: 'test-app', organizationId: null });
        });

        it('always scopes the public list to the configured app (shared-DB multi-app safety)', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            await handlers.handleBlogPostsList(ctxFor('/posts'));
            let where = vi.mocked(Post.paginate).mock.calls.at(-1)![2] as Record<string, unknown>;
            expect(where.appId).toBe('test-app');

            // Request-controlled app IDs are ignored.
            await handlers.handleBlogPostsList(ctxFor('/posts?appId=other-app'));
            where = vi.mocked(Post.paginate).mock.calls.at(-1)![2] as Record<string, unknown>;
            expect(where.appId).toBe('test-app');
        });

        it('scopes related posts to the blog', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            vi.mocked(Post.first).mockResolvedValueOnce({ get: () => 'blog' } as any);

            await handlers.handleBlogRelatedPosts(ctxFor('/posts/p1/related'), 'p1');

            expect(Post.first).toHaveBeenCalledWith({
                id: 'p1',
                status: 'published',
                appId: 'test-app',
                organizationId: null,
            });
            expect(Post.related).toHaveBeenCalledWith(
                'p1',
                expect.objectContaining({ appId: 'test-app', organizationId: null }),
            );
        });
    });

    describe('date archive filtering', () => {
        it('filters posts by year when ?year is provided', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            await handlers.handleBlogPostsList(ctxFor('/posts?year=2025'));

            const where = vi.mocked(Post.paginate).mock.calls.at(-1)![2] as Record<string, unknown>;
            const range = where.publishedAt as { $gte: number; $lt: number };
            expect(range.$gte).toBe(Date.UTC(2025, 0, 1));
            expect(range.$lt).toBe(Date.UTC(2026, 0, 1));
        });

        it('filters posts by year+month when both are provided', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            await handlers.handleBlogPostsList(ctxFor('/posts?year=2025&month=8'));

            const where = vi.mocked(Post.paginate).mock.calls.at(-1)![2] as Record<string, unknown>;
            const range = where.publishedAt as { $gte: number; $lt: number };
            expect(range.$gte).toBe(Date.UTC(2025, 7, 1));
            expect(range.$lt).toBe(Date.UTC(2025, 8, 1));
        });

        it('returns 400 for invalid year', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            const response = await handlers.handleBlogPostsList(ctxFor('/posts?year=abc'));
            expect(response.status).toBe(400);
        });

        it('returns 400 for invalid month', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            const response = await handlers.handleBlogPostsList(ctxFor('/posts?year=2025&month=13'));
            expect(response.status).toBe(400);
        });
    });

    describe('organization blogs (?blog=)', () => {
        const ACME = { id: 'org-1', slug: 'acme', name: 'Acme', status: 'active' };
        const orgConfig = { ...baseConfig, orgBlogs: true };
        let findBySlug: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            findBySlug = vi.spyOn(Organization, 'findBySlug').mockResolvedValue(ACME as any);
            // The blog is public: it has a published post.
            vi.mocked(Post.where).mockResolvedValue([{ get: () => 'p0' }] as any);
        });
        afterEach(() => {
            findBySlug.mockRestore();
            vi.mocked(Post.where).mockReset().mockResolvedValue([]);
        });

        it("scopes the public posts list to the named organization's blog", async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            const response = await handlers.handleBlogPostsList(ctxFor('/posts?blog=acme'));

            expect(response.status).toBe(200);
            expect(findBySlug).toHaveBeenCalledWith('acme');
            const where = vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;
            expect(where).toMatchObject({ appId: 'test-app', organizationId: 'org-1' });
        });

        it('scopes by-slug lookups to that blog', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/hello?blog=acme'), 'hello');

            expect(Post.first).toHaveBeenCalledWith(
                expect.objectContaining({ slug: 'hello', status: 'published', organizationId: 'org-1' }),
            );
        });

        it('threads the blog into taxonomy lookups', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            await handlers.handleBlogTagBySlug(ctxFor('/tags/by-slug/t?blog=acme'), 't');

            expect(PostTag.findBySlug).toHaveBeenCalledWith('t', {
                appId: 'test-app',
                organizationId: 'org-1',
                type: 'post',
            });
        });

        it("serves that blog's public studio state with its identity", async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            const response = await handlers.handleBlogStudioState(ctxFor('/studio/state?blog=acme'));

            expect(StudioManager.getState).toHaveBeenCalledWith({ appId: 'test-app', organizationId: 'org-1' });
            expect((await response.json()).blog).toEqual({ slug: 'acme', name: 'Acme' });
        });

        it('serves the site blog identity as null', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            const response = await handlers.handleBlogStudioState(ctxFor('/studio/state'));

            expect(StudioManager.getState).toHaveBeenCalledWith({ appId: 'test-app', organizationId: null });
            expect((await response.json()).blog).toBeNull();
            expect(findBySlug).not.toHaveBeenCalled();
        });

        it('answers 404 BLOG_NOT_FOUND when organization blogs are off, without looking the slug up', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            const response = await handlers.handleBlogPostsList(ctxFor('/posts?blog=acme'));

            expect(response.status).toBe(404);
            expect((await response.json()).code).toBe('BLOG_NOT_FOUND');
            expect(findBySlug).not.toHaveBeenCalled();
            expect(Post.paginate).not.toHaveBeenCalled();
        });

        it('answers 404 for an unknown or inactive organization', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);

            findBySlug.mockResolvedValueOnce(undefined);
            expect((await handlers.handleBlogPostsList(ctxFor('/posts?blog=nobody'))).status).toBe(404);

            findBySlug.mockResolvedValueOnce({ ...ACME, status: 'suspended' } as any);
            const suspended = await handlers.handleBlogStudioState(ctxFor('/studio/state?blog=acme'));
            expect(suspended.status).toBe(404);
            expect((await suspended.json()).code).toBe('BLOG_NOT_FOUND');
            expect(Post.paginate).not.toHaveBeenCalled();
        });

        it('keeps an organization blog private until its first published post', async () => {
            vi.mocked(Post.where).mockResolvedValue([]);
            const handlers = createBlogHandlers<Env>(orgConfig);

            for (const response of [
                await handlers.handleBlogStudioState(ctxFor('/studio/state?blog=acme')),
                await handlers.handleBlogPostsList(ctxFor('/posts?blog=acme')),
                await handlers.handleBlogRssFeed(ctxFor('/rss?blog=acme')),
                await handlers.handleBlogSitemap(ctxFor('/sitemap.xml?blog=acme')),
                await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/hello?blog=acme'), 'hello'),
            ]) {
                expect(response.status).toBe(404);
                expect((await response.json()).code).toBe('BLOG_NOT_FOUND');
            }
            // The probe: one published, non-changelog post of exactly this blog.
            expect(Post.where).toHaveBeenCalledWith(
                {
                    appId: 'test-app',
                    organizationId: 'org-1',
                    status: 'published',
                    contentType: { $ne: 'changelog' },
                },
                { select: ['id'], limit: 1 },
            );
            expect(Post.paginate).not.toHaveBeenCalled();
        });

        it('reads orgBlogs per request when it is a function of env', async () => {
            const seen: string[] = [];
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                orgBlogs: (e) => {
                    seen.push(e.marker);
                    return e.marker === 'on';
                },
            });

            const off = await handlers.handleBlogPostsList({ ...ctxFor('/posts?blog=acme'), env: { marker: 'off' } });
            const on = await handlers.handleBlogPostsList({ ...ctxFor('/posts?blog=acme'), env: { marker: 'on' } });

            expect(seen).toEqual(['off', 'on']);
            expect(off.status).toBe(404);
            expect(on.status).toBe(200);
        });

        it('links RSS items and the feed itself to the organization blog', async () => {
            const post = {
                get: (field: string) =>
                    ({ id: 'p1', slug: 'hello', contentType: 'blog', publishedAt: 1, authorId: null })[field] ?? null,
                toJson: () => ({ id: 'p1', slug: 'hello', title: 'Hello', contentType: 'blog', publishedAt: 1 }),
            };
            vi.mocked(Post.where)
                .mockResolvedValueOnce([{ get: () => 'p0' }] as any) // public probe
                .mockResolvedValueOnce([post] as any); // feed window
            const handlers = createBlogHandlers<Env>(orgConfig);

            const response = await handlers.handleBlogRssFeed(ctxFor('/rss?blog=acme'));
            const xml = await response.text();

            expect(xml).toContain('<title>Acme</title>');
            expect(xml).toContain('<link>https://x.test/blogs/acme</link>');
            expect(xml).toContain('<link>https://x.test/blogs/acme/hello</link>');
            expect(xml).toContain('href="https://x.test/api/blog/rss?blog=acme"');
            expect(response.headers.get('Vary')).toBe('Accept-Language');
        });

        it('carries the blog into sitemap URLs and sitemap-index pages', async () => {
            const post = {
                get: (field: string) =>
                    ({ id: 'p1', slug: 'hello', language: 'en', contentType: 'blog', updatedAt: 0 })[field],
            };
            vi.mocked(Post.where)
                .mockResolvedValueOnce([{ get: () => 'p0' }] as any)
                .mockResolvedValueOnce([post] as any);
            const handlers = createBlogHandlers<Env>(orgConfig);
            const sitemap = await (await handlers.handleBlogSitemap(ctxFor('/sitemap.xml?blog=acme'))).text();
            expect(sitemap).toContain('<loc>https://x.test/blogs/acme</loc>');
            expect(sitemap).toContain('<loc>https://x.test/blogs/acme/hello</loc>');

            vi.mocked(Post.paginate).mockResolvedValueOnce({
                data: [],
                page: 1,
                perPage: 10,
                total: 20,
                totalPages: 2,
            } as any);
            const index = await (await handlers.handleBlogSitemap(ctxFor('/sitemap-index.xml?blog=acme'))).text();
            expect(index).toContain('page=2');
            expect(index).toContain('&amp;blog=acme');
        });
    });

    describe('public series list', () => {
        it('lists the series a reader can see a post of, in display order', async () => {
            vi.mocked(Post.seriesIdsOf).mockResolvedValueOnce(['s1', 's2']);
            const series = (id: string, title: string, sortOrder: number) => ({
                get: (field: string) => ({ id, title, sortOrder })[field],
                toJson: () => ({ id, title, sortOrder }),
            });
            vi.mocked(PostSeries.whereIn).mockResolvedValueOnce([
                series('s2', 'Zeta', 0),
                series('s1', 'Alpha', 1),
            ] as any);
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogSeriesList(ctxFor('/series'));

            expect((await response.json()).data.map((row: { id: string }) => row.id)).toEqual(['s2', 's1']);
            expect(Post.seriesIdsOf).toHaveBeenCalledWith({
                appId: 'test-app',
                organizationId: null,
                status: 'published',
                contentType: { $ne: 'changelog' },
            });
            expect(PostSeries.whereIn).toHaveBeenCalledWith('id', ['s1', 's2']);
        });

        it('answers an empty list without querying series when no post has one', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            const response = await handlers.handleBlogSeriesList(ctxFor('/series'));

            expect(await response.json()).toEqual({ data: [] });
            expect(PostSeries.whereIn).not.toHaveBeenCalled();
        });

        it('answers a series by slug only while it has a published post', async () => {
            const row = { get: () => 's1', toJson: () => ({ id: 's1', slug: 'trip' }) };
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            vi.mocked(PostSeries.findBySlug).mockResolvedValueOnce(row as any);
            vi.mocked(Post.where).mockResolvedValueOnce([]);
            expect((await handlers.handleBlogSeriesBySlug(ctxFor('/series/by-slug/trip'), 'trip')).status).toBe(404);

            vi.mocked(PostSeries.findBySlug).mockResolvedValueOnce(row as any);
            vi.mocked(Post.where).mockResolvedValueOnce([{ get: () => 'p1' }] as any);
            const found = await handlers.handleBlogSeriesBySlug(ctxFor('/series/by-slug/trip'), 'trip');
            expect(found.status).toBe(200);
            expect(PostSeries.findBySlug).toHaveBeenLastCalledWith('trip', { appId: 'test-app', organizationId: null });
            expect(Post.where).toHaveBeenLastCalledWith(
                expect.objectContaining({ seriesId: 's1', status: 'published', organizationId: null }),
                { select: ['id'], limit: 1 },
            );
        });
    });

    describe('scoped studio guard', () => {
        it('guards mutations against the editorial blog and propagates denial', async () => {
            const denial = new Response('not-your-blog', { status: 403 });
            const requireScopedStudioAdmin = vi.fn(async () => denial);
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                resolveEditorialScope: vi.fn(async () => 'org-1'),
                requireScopedStudioAdmin,
            });

            const response = await handlers.handleBlogStudioActivateTheme(
                ctxFor('/studio/theme/activate', { method: 'POST', body: JSON.stringify({ themeId: 'default' }) }),
            );

            expect(response).toBe(denial);
            expect(requireScopedStudioAdmin).toHaveBeenCalledWith(expect.anything(), { organizationId: 'org-1' });
            // The plain admin guard is bypassed when the scoped seam is present.
            expect(baseConfig.requireAdmin).not.toHaveBeenCalled();
        });

        it('targets the site blog (null) without an editorial scope, or when it resolves null', async () => {
            const requireScopedStudioAdmin = vi.fn(async () => ({ session: null }));

            const explicit = createBlogHandlers<Env>({
                ...baseConfig,
                resolveEditorialScope: vi.fn(async () => null),
                requireScopedStudioAdmin,
            });
            await explicit.handleBlogStudioThemeTokens(
                ctxFor('/studio/theme/tokens', { method: 'POST', body: JSON.stringify({ themeId: 't' }) }),
            );
            expect(requireScopedStudioAdmin).toHaveBeenLastCalledWith(expect.anything(), { organizationId: null });

            const implicit = createBlogHandlers<Env>({ ...baseConfig, requireScopedStudioAdmin });
            await implicit.handleBlogStudioPluginEnable(
                ctxFor('/studio/plugin/enable', { method: 'POST', body: JSON.stringify({ pluginId: 'p' }) }),
            );
            expect(requireScopedStudioAdmin).toHaveBeenLastCalledWith(expect.anything(), { organizationId: null });
        });

        it('writes theme and plugin rows into the editorial blog only', async () => {
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                resolveEditorialScope: () => 'org-1',
                requireScopedStudioAdmin: vi.fn(async () => ({ session: null })),
            });
            const blog = { appId: 'test-app', organizationId: 'org-1' };

            await handlers.handleBlogStudioActivateTheme(
                ctxFor('/studio/theme/activate', { method: 'POST', body: JSON.stringify({ themeId: 'minimal' }) }),
            );
            expect(OttablogTheme.findByThemeId).toHaveBeenCalledWith('minimal', blog);
            expect(OttablogTheme.create).toHaveBeenCalledWith(expect.objectContaining({ themeId: 'minimal', ...blog }));

            await handlers.handleBlogStudioPluginEnable(
                ctxFor('/studio/plugin/enable', { method: 'POST', body: JSON.stringify({ pluginId: 'p' }) }),
            );
            expect(OttablogPlugin.findByPluginId).toHaveBeenCalledWith('p', blog);
            expect(OttablogPlugin.create).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'p', ...blog }));
        });

        it('falls back to requireAdmin when the scoped seam is absent', async () => {
            const denial = new Response('platform-only', { status: 403 });
            const requireAdmin = vi.fn(async () => denial);
            const handlers = createBlogHandlers<Env>({ ...baseConfig, requireAdmin });

            const response = await handlers.handleBlogStudioActivateTheme(
                ctxFor('/studio/theme/activate', { method: 'POST', body: JSON.stringify({ themeId: 'default' }) }),
            );

            expect(response).toBe(denial);
            expect(requireAdmin).toHaveBeenCalled();
        });
    });

    describe('studio state shapes', () => {
        const fullState = {
            activeThemeId: 'default',
            themes: [
                { themeId: 'default', isActive: true, tokens: { light: { '--x': '1' } }, config: null },
                { themeId: 'stash', isActive: false, tokens: { light: { '--secret': '1' } }, config: { k: 'v' } },
            ],
            plugins: [
                { id: '1', pluginId: 'on', name: 'On', description: 'live', enabled: true, config: { a: 1 } },
                { id: '2', pluginId: 'off', name: 'Off', description: 'hidden', enabled: false, config: { b: 2 } },
            ],
        };

        it('serves the public rendering shape by default: active theme only, disabled-plugin config stripped', async () => {
            vi.mocked(StudioManager.getState).mockResolvedValue(fullState as any);
            const requireAdmin = vi.fn(async () => new Response('no', { status: 403 }));
            const handlers = createBlogHandlers<Env>({ ...baseConfig, requireAdmin });

            const response = await handlers.handleBlogStudioState(ctxFor('/studio/state'));
            const body = (await response.json()) as typeof fullState;

            expect(body.themes.map((t) => t.themeId)).toEqual(['default']);
            expect(body.plugins.find((p) => p.pluginId === 'on')?.config).toEqual({ a: 1 });
            const off = body.plugins.find((p) => p.pluginId === 'off');
            expect(off?.enabled).toBe(false); // signal retained for client deactivation
            expect(off?.config).toBeNull();
            expect(off?.description).toBeNull();
            // A public read never consults the admin guard, and never seeds.
            expect(requireAdmin).not.toHaveBeenCalled();
        });

        it('serves the full payload of the editorial blog only to its studio admin', async () => {
            vi.mocked(StudioManager.getState).mockResolvedValue(fullState as any);

            const adminHandlers = createBlogHandlers<Env>({
                ...baseConfig,
                requireAdmin: vi.fn(async () => ({ session: null })),
            });
            const adminResponse = await adminHandlers.handleBlogStudioState(ctxFor('/studio/state?full=1'));
            const adminBody = (await adminResponse.json()) as typeof fullState & { blog: unknown };
            expect(adminBody.themes.map((t) => t.themeId)).toEqual(['default', 'stash']);
            expect(adminBody.plugins.find((p) => p.pluginId === 'off')?.config).toEqual({ b: 2 });
            expect(adminBody.blog).toBeNull();
            expect(adminResponse.headers.get('cache-control')).toBe('no-store');

            // No silent downgrade to the public shape: a non-admin asking for the Studio is refused.
            const anonHandlers = createBlogHandlers<Env>({
                ...baseConfig,
                requireAdmin: vi.fn(async () => new Response('no', { status: 401 })),
            });
            const anonResponse = await anonHandlers.handleBlogStudioState(ctxFor('/studio/state?full=1'));
            expect(anonResponse.status).toBe(401);
        });

        it("names an organization's blog in its full state", async () => {
            vi.mocked(StudioManager.getState).mockResolvedValue(fullState as any);
            const find = vi.spyOn(Organization, 'find').mockResolvedValue({
                get: (field: string) => ({ slug: 'acme', name: 'Acme' })[field],
            } as any);
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                resolveEditorialScope: () => 'org-1',
                requireScopedStudioAdmin: vi.fn(async () => ({ session: null })),
            });

            const body = await (await handlers.handleBlogStudioState(ctxFor('/studio/state?full=1'))).json();

            expect(StudioManager.getState).toHaveBeenCalledWith({ appId: 'test-app', organizationId: 'org-1' });
            expect(find).toHaveBeenCalledWith('org-1');
            expect(body.blog).toEqual({ slug: 'acme', name: 'Acme' });
            find.mockRestore();
        });

        it("seeds the editorial blog's default rows on its admin's first Studio load", async () => {
            vi.mocked(StudioManager.getState)
                .mockResolvedValueOnce({ activeThemeId: null, themes: [], plugins: [] } as any)
                .mockResolvedValueOnce(fullState as any);
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                resolveEditorialScope: () => 'org-1',
                requireScopedStudioAdmin: vi.fn(async () => ({ session: null })),
            });
            vi.spyOn(Organization, 'find').mockResolvedValueOnce(null as any);

            await handlers.handleBlogStudioState(ctxFor('/studio/state?full=1'));

            const blog = { appId: 'test-app', organizationId: 'org-1' };
            expect(OttablogTheme.create).toHaveBeenCalledWith(expect.objectContaining({ themeId: 'default', ...blog }));
            expect(OttablogPlugin.create).toHaveBeenCalledWith(expect.objectContaining(blog));

            // A visitor's read of an unseeded blog writes nothing.
            vi.mocked(OttablogTheme.create).mockClear();
            vi.mocked(StudioManager.getState).mockResolvedValueOnce({
                activeThemeId: null,
                themes: [],
                plugins: [],
            } as any);
            await handlers.handleBlogStudioState(ctxFor('/studio/state'));
            expect(OttablogTheme.create).not.toHaveBeenCalled();
        });
    });

    describe('draft preview', () => {
        const SECRET = 'preview-secret-32-characters-long!!!';
        const CALLER = { session: { user: { id: 'author-1' } } };
        const previewConfig = {
            ...baseConfig,
            // Mint authorization is object-level: default caller is the post's author.
            requireAdmin: vi.fn(async () => CALLER),
            previewTokenSecret: () => SECRET,
        };

        /** A post row owned by author-1 (matches CALLER) unless overridden. */
        const ownPostRow = (slug: string, fields: Record<string, unknown> = {}) =>
            ({
                get: (k: string) => (({ slug, authorId: 'author-1', userId: 'author-1', ...fields }) as any)[k] ?? null,
            }) as any;

        async function mintToken(handlers: ReturnType<typeof createBlogHandlers<Env>>, slug: string) {
            vi.mocked(Post.first).mockResolvedValueOnce(ownPostRow(slug));
            const response = await handlers.handleBlogPreviewTokenMint({
                ...ctxFor('/posts/preview-token', {
                    method: 'POST',
                    body: JSON.stringify({ slug }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            });
            expect(response.status).toBe(200);
            return (await response.json()) as { token: string; expiresAt: number; path: string };
        }

        it('mint denies (404, same as missing) for a post the caller does not own', async () => {
            const handlers = createBlogHandlers<Env>(previewConfig);
            vi.mocked(Post.first).mockResolvedValueOnce(
                ownPostRow('their-draft', { authorId: 'someone-else', userId: 'someone-else' }),
            );

            const response = await handlers.handleBlogPreviewTokenMint(
                ctxFor('/posts/preview-token', { method: 'POST', body: JSON.stringify({ slug: 'their-draft' }) }),
            );

            expect(response.status).toBe(404);
        });

        it('mint consults canManagePost with the POST ROW org for non-owned posts', async () => {
            const canManagePost = vi.fn(async () => true);
            const handlers = createBlogHandlers<Env>({ ...previewConfig, canManagePost });
            vi.mocked(Post.first).mockResolvedValueOnce(
                ownPostRow('their-draft', {
                    id: 'p9',
                    authorId: 'someone-else',
                    userId: null,
                    organizationId: 'org-9',
                }),
            );

            const response = await handlers.handleBlogPreviewTokenMint(
                ctxFor('/posts/preview-token', { method: 'POST', body: JSON.stringify({ slug: 'their-draft' }) }),
            );

            expect(response.status).toBe(200);
            expect(canManagePost).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ id: 'p9', authorId: 'someone-else', organizationId: 'org-9' }),
            );
        });

        it("binds the token to the editorial blog and links to that blog's post page", async () => {
            const find = vi.spyOn(Organization, 'find').mockResolvedValue({
                get: (field: string) => ({ slug: 'acme', name: 'Acme' })[field],
            } as any);
            const handlers = createBlogHandlers<Env>({ ...previewConfig, resolveEditorialScope: () => 'org-1' });
            vi.mocked(Post.first).mockResolvedValueOnce(ownPostRow('draft', { organizationId: 'org-1' }));

            const response = await handlers.handleBlogPreviewTokenMint(
                ctxFor('/posts/preview-token', { method: 'POST', body: JSON.stringify({ slug: 'draft' }) }),
            );
            expect(response.status).toBe(200);
            const { token, path } = (await response.json()) as { token: string; path: string };

            // The post is looked up in the editorial blog only.
            expect(Post.first).toHaveBeenCalledWith({ slug: 'draft', appId: 'test-app', organizationId: 'org-1' });
            const { verifyPreviewToken } = await import('../preview-token');
            expect((await verifyPreviewToken(SECRET, token))?.organizationId).toBe('org-1');
            expect(path).toBe(`/blogs/acme/draft?preview=${encodeURIComponent(token)}`);
            find.mockRestore();
        });

        it('mint responds 404 when no preview secret is configured', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            const response = await handlers.handleBlogPreviewTokenMint(
                ctxFor('/posts/preview-token', { method: 'POST', body: JSON.stringify({ slug: 's' }) }),
            );
            expect(response.status).toBe(404);
        });

        it('mint uses the content-editor guard when provided, admin guard otherwise', async () => {
            const denial = new Response('editor-denied', { status: 403 });
            const requireContentEditor = vi.fn(async () => denial);
            const requireAdmin = vi.fn(async () => ({ session: null }));
            const handlers = createBlogHandlers<Env>({
                ...previewConfig,
                requireAdmin,
                requireContentEditor,
            });

            const response = await handlers.handleBlogPreviewTokenMint(
                ctxFor('/posts/preview-token', { method: 'POST', body: JSON.stringify({ slug: 's' }) }),
            );

            expect(response).toBe(denial);
            expect(requireContentEditor).toHaveBeenCalled();
            expect(requireAdmin).not.toHaveBeenCalled();
        });

        it('a minted token unlocks the unpublished post on the by-slug route', async () => {
            const handlers = createBlogHandlers<Env>(previewConfig);
            const { token, path } = await mintToken(handlers, 'my-draft');
            expect(path).toBe(`/blog/my-draft?preview=${encodeURIComponent(token)}`);

            const draft = {
                get: (k: string) =>
                    (({ slug: 'my-draft', title: 'Draft', status: 'draft', contentType: 'blog' }) as any)[k] ?? null,
                toJson: () => ({ id: 'p1', slug: 'my-draft', title: 'Draft', status: 'draft', contentType: 'blog' }),
                author: async () => null,
                tags: async () => [],
            };
            vi.mocked(Post.first).mockResolvedValueOnce(draft as any);

            const response = await handlers.handleBlogPostBySlug(
                ctxFor(`/posts/by-slug/my-draft?preview=${encodeURIComponent(token)}`),
                'my-draft',
            );

            expect(response.status).toBe(200);
            const body = (await response.json()) as Record<string, unknown>;
            expect(body.preview).toBe(true);
            // The preview lookup must NOT filter by published status.
            const previewWhere = vi.mocked(Post.first).mock.calls.at(-1)![0] as Record<string, unknown>;
            expect('status' in previewWhere).toBe(false);
        });

        it('an invalid preview token falls back to the published-only lookup', async () => {
            const handlers = createBlogHandlers<Env>(previewConfig);
            vi.mocked(Post.first).mockResolvedValue(null as any);

            const response = await handlers.handleBlogPostBySlug(
                ctxFor('/posts/by-slug/my-draft?preview=garbage.token'),
                'my-draft',
            );

            expect(response.status).toBe(404);
            const lastWhere = vi.mocked(Post.first).mock.calls.at(-1)![0] as Record<string, unknown>;
            expect(lastWhere.status).toBe('published');
        });

        it('a token minted for one slug does not unlock another', async () => {
            const handlers = createBlogHandlers<Env>(previewConfig);
            const { token } = await mintToken(handlers, 'my-draft');

            vi.mocked(Post.first).mockResolvedValue(null as any);
            const response = await handlers.handleBlogPostBySlug(
                ctxFor(`/posts/by-slug/other-post?preview=${encodeURIComponent(token)}`),
                'other-post',
            );

            expect(response.status).toBe(404);
            const lastWhere = vi.mocked(Post.first).mock.calls.at(-1)![0] as Record<string, unknown>;
            expect(lastWhere.status).toBe('published');
        });

        it("a token for one blog's post never opens the same slug on another blog", async () => {
            const findBySlug = vi
                .spyOn(Organization, 'findBySlug')
                .mockResolvedValue({ id: 'org-1', slug: 'acme', name: 'Acme', status: 'active' } as any);
            vi.mocked(Post.where).mockResolvedValue([{ get: () => 'p0' }] as any);
            const handlers = createBlogHandlers<Env>({ ...previewConfig, orgBlogs: true });
            // Minted for the SITE blog's "my-draft".
            const { token } = await mintToken(handlers, 'my-draft');

            vi.mocked(Post.first).mockResolvedValue(null as any);
            const response = await handlers.handleBlogPostBySlug(
                ctxFor(`/posts/by-slug/my-draft?blog=acme&preview=${encodeURIComponent(token)}`),
                'my-draft',
            );

            expect(response.status).toBe(404);
            const lastWhere = vi.mocked(Post.first).mock.calls.at(-1)![0] as Record<string, unknown>;
            expect(lastWhere).toMatchObject({ status: 'published', organizationId: 'org-1' });
            findBySlug.mockRestore();
            vi.mocked(Post.where).mockReset().mockResolvedValue([]);
        });

        it('a preview reads its draft before the organization blog has gone public', async () => {
            const findBySlug = vi
                .spyOn(Organization, 'findBySlug')
                .mockResolvedValue({ id: 'org-1', slug: 'acme', name: 'Acme', status: 'active' } as any);
            const find = vi.spyOn(Organization, 'find').mockResolvedValue({
                get: (field: string) => ({ slug: 'acme', name: 'Acme' })[field],
            } as any);
            vi.mocked(Post.where).mockResolvedValue([]); // no published post yet
            const handlers = createBlogHandlers<Env>({
                ...previewConfig,
                orgBlogs: true,
                resolveEditorialScope: () => 'org-1',
            });
            const { token } = await mintToken(handlers, 'first-post');
            const draft = {
                get: (k: string) => (({ slug: 'first-post', status: 'draft', contentType: 'blog' }) as any)[k] ?? null,
                toJson: () => ({ id: 'p1', slug: 'first-post', status: 'draft', contentType: 'blog' }),
                author: async () => null,
                tags: async () => [],
            };
            vi.mocked(Post.first).mockResolvedValueOnce(draft as any);

            const response = await handlers.handleBlogPostBySlug(
                ctxFor(`/posts/by-slug/first-post?blog=acme&preview=${encodeURIComponent(token)}`),
                'first-post',
            );

            expect(response.status).toBe(200);
            expect((await response.json()).preview).toBe(true);
            // Without the token, the same blog does not exist yet.
            const anonymous = await handlers.handleBlogPostBySlug(
                ctxFor('/posts/by-slug/first-post?blog=acme'),
                'first-post',
            );
            expect(anonymous.status).toBe(404);
            findBySlug.mockRestore();
            find.mockRestore();
        });
    });
});

describe('blog scope migration', () => {
    /** A fake migration DB: records statements, answers the org-blogs probe, optionally fails some. */
    function fakeDb(options: { servedOrgBlogs?: boolean; fail?: RegExp } = {}) {
        const executed: string[] = [];
        const db = {
            executeRaw: vi.fn(async (sql: string) => {
                executed.push(sql);
                if (options.fail?.test(sql)) throw new Error('no such table');
                if (sql.startsWith('SELECT 1 FROM _ottabase_migrations')) {
                    return { results: options.servedOrgBlogs ? [{ 1: 1 }] : [] };
                }
                return { results: [] };
            }),
        };
        return { db, executed };
    }

    async function run(db: { executeRaw: (sql: string, params?: unknown[]) => Promise<unknown> }) {
        const { ottablogMigrations } = await import('../migrations');
        expect(ottablogMigrations.map((m) => m.name)).toEqual(['ottablog_blog_scopes_v1']);
        await ottablogMigrations[0].up(db);
    }

    it('turns an install that served one blog into the site blog', async () => {
        const { db, executed } = fakeDb();
        await run(db);

        const rescoped = executed.filter((sql) => sql.startsWith('UPDATE OR IGNORE'));
        expect(rescoped).toHaveLength(9);
        for (const sql of rescoped) expect(sql).toMatch(/SET organization_id = NULL$/);
        expect(rescoped.some((sql) => sql.includes(' posts '))).toBe(true);
        expect(db.executeRaw).toHaveBeenCalledWith(expect.stringContaining('_ottabase_migrations'), [
            'ottablog_org_mode_slug_scope_v1',
        ]);
    });

    it('keeps the scopes of an install that already served organization blogs', async () => {
        const { db, executed } = fakeDb({ servedOrgBlogs: true });
        await run(db);

        expect(executed.some((sql) => sql.startsWith('UPDATE OR IGNORE'))).toBe(false);
        // Comments still follow their post, and the app-wide indexes still go.
        expect(executed.some((sql) => sql.startsWith('UPDATE comments'))).toBe(true);
        expect(executed.filter((sql) => sql.startsWith('DROP INDEX IF EXISTS'))).toHaveLength(6);
    });

    it("moves post comments into their post's blog and drops the six app-wide slug indexes", async () => {
        const { db, executed } = fakeDb();
        await run(db);

        const comments = executed.find((sql) => sql.startsWith('UPDATE comments'))!;
        expect(comments).toContain('SELECT posts.organization_id FROM posts WHERE posts.id = comments.target_id');
        expect(comments).toContain("target_type = 'post'");
        expect(executed.filter((sql) => sql.startsWith('DROP INDEX IF EXISTS'))).toEqual([
            'DROP INDEX IF EXISTS posts_app_id_slug_unique_idx',
            'DROP INDEX IF EXISTS categories_app_id_type_slug_unique_idx',
            'DROP INDEX IF EXISTS post_tags_app_id_type_slug_unique_idx',
            'DROP INDEX IF EXISTS series_app_id_slug_unique_idx',
            'DROP INDEX IF EXISTS ottablog_themes_app_id_theme_id_unique_idx',
            'DROP INDEX IF EXISTS ottablog_plugins_app_id_plugin_id_unique_idx',
        ]);
    });

    it('runs without a comments table', async () => {
        const { db, executed } = fakeDb({ fail: /^UPDATE comments/ });
        await expect(run(db)).resolves.toBeUndefined();
        expect(executed.filter((sql) => sql.startsWith('DROP INDEX'))).toHaveLength(6);
    });
});

describe('author archive, export, and import', () => {
    const editorContext = {
        userId: 'u1',
        organizationId: 'org-1',
        appId: 'test-app',
        permissions: ['posts:create', 'posts:update'],
    };
    const configFor = (securityContext: Record<string, unknown>) => ({
        connect: vi.fn(() => null),
        defaultAppId: () => 'test-app',
        requireAdmin: vi.fn(async () => ({ session: null })),
        checkCronAuth: vi.fn(() => false),
        verifyPassword: vi.fn(async () => false),
        requireContentCreator: vi.fn(async () => ({ session: { user: { id: 'u1' } }, securityContext })),
        requireContentEditor: vi.fn(async () => ({ session: { user: { id: 'u1' } }, securityContext })),
    });
    const record = (fields: Record<string, unknown>) => ({ get: (field: string) => fields[field] ?? null });
    const importRequest = (posts: unknown[]) =>
        ctxFor('/import', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ posts }),
        });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.first).mockResolvedValue(null as any);
        vi.mocked(Post.paginate).mockResolvedValue({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 } as any);
        vi.mocked(Post.create).mockImplementation(async (data: any) => record({ id: `id-${data.slug}` }) as any);
        vi.spyOn(globalRLS, 'validateWrite').mockImplementation(() => undefined);
        vi.spyOn(globalRLS, 'getReadFilter').mockReturnValue({ organizationId: 'org-1' });
    });

    it('filters the public list by author', async () => {
        const handlers = createBlogHandlers<Env>(configFor(editorContext));
        await handlers.handleBlogPostsList(ctxFor('/posts?authorId=a1'));
        const where = vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;
        expect(where).toMatchObject({ authorId: 'a1', status: 'published', appId: 'test-app' });
    });

    it('answers for an author only through one of their published posts, with the public projection', async () => {
        const handlers = createBlogHandlers<Env>(configFor(editorContext));
        expect((await handlers.handleBlogAuthorById(ctxFor('/authors/stranger'), 'stranger')).status).toBe(404);

        const author = record({ id: 'a1', name: 'Ada', image: '/ada.png', email: 'private@example.com' });
        const post = { author: vi.fn(async () => author) };
        vi.mocked(Post.where).mockResolvedValueOnce([post] as any);
        const response = await handlers.handleBlogAuthorById(ctxFor('/authors/a1'), 'a1');

        expect(await response.json()).toEqual({ id: 'a1', name: 'Ada', image: '/ada.png' });
        expect(post.author).toHaveBeenCalledWith(['id', 'name', 'image']);
        expect(Post.where).toHaveBeenLastCalledWith(
            {
                authorId: 'a1',
                appId: 'test-app',
                organizationId: null,
                status: 'published',
                contentType: { $ne: 'changelog' },
            },
            { select: ['id', 'authorId'], limit: 1 },
        );
    });

    it('exports readable posts with taxonomy names and never a password hash', async () => {
        vi.mocked(Post.where).mockResolvedValueOnce([
            record({
                id: 'p1',
                title: 'Hello',
                slug: 'hello',
                status: 'published',
                seriesId: 's1',
                isProtected: true,
                passwordHash: 'secret-hash',
                publishedAt: 1700000000000,
            }),
        ] as any);
        vi.mocked(PostTagLink.whereIn).mockResolvedValueOnce([record({ postId: 'p1', tagId: 't1' })] as any);
        vi.mocked(PostTag.whereIn).mockResolvedValueOnce([record({ id: 't1', name: 'Travel' })] as any);
        vi.mocked(PostSeries.whereIn).mockResolvedValueOnce([record({ id: 's1', title: 'Japan' })] as any);
        const handlers = createBlogHandlers<Env>(configFor(editorContext));

        const response = await handlers.handleBlogExport(ctxFor('/export'));
        const file = (await response.json()) as { format: string; version: number; posts: Record<string, unknown>[] };

        expect(Post.where).toHaveBeenCalledWith(
            { organizationId: 'org-1' },
            expect.objectContaining({ withDeferred: true }),
        );
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(file).toMatchObject({ format: 'ottablog', version: 1 });
        expect(file.posts[0]).toMatchObject({
            title: 'Hello',
            slug: 'hello',
            publishedAt: 1700000000000,
            isProtected: true,
            tags: ['Travel'],
            categories: [],
            series: 'Japan',
        });
        expect(file.posts[0]).not.toHaveProperty('passwordHash');
        expect(file.posts[0]).not.toHaveProperty('id');
    });

    it('imports as the caller, keeps the original date, and skips existing slugs', async () => {
        const handlers = createBlogHandlers<Env>(
            configFor({ ...editorContext, permissions: ['posts:create', 'posts:publish'] }),
        );
        vi.mocked(Post.first).mockImplementation(
            async (where: any) => (where?.slug === 'taken' ? record({}) : null) as any,
        );

        const response = await handlers.handleBlogImport(
            importRequest([
                {
                    title: 'Old post',
                    slug: 'Old-Post',
                    status: 'published',
                    publishedAt: 1500000000000,
                    authorId: 'spoofed',
                },
                { title: 'Taken', slug: 'taken' },
            ]),
        );

        expect(await response.json()).toEqual({
            created: [{ slug: 'old-post', id: 'id-old-post' }],
            skipped: [{ slug: 'taken', reason: 'A post with this slug already exists' }],
            warnings: [],
        });
        expect(Post.create).toHaveBeenCalledTimes(1);
        // Slugs are unique per blog: the probe asks the caller's blog only.
        expect(Post.first).toHaveBeenCalledWith({ slug: 'taken', appId: 'test-app', organizationId: 'org-1' });
        expect(vi.mocked(Post.create).mock.calls[0][0]).toMatchObject({
            slug: 'old-post',
            status: 'published',
            publishedAt: 1500000000000,
            language: 'en',
            authorId: 'u1',
            userId: 'u1',
            organizationId: 'org-1',
            appId: 'test-app',
        });
    });

    it('lands live and protected posts as drafts when the caller cannot publish them safely', async () => {
        const handlers = createBlogHandlers<Env>(configFor(editorContext));

        const response = await handlers.handleBlogImport(
            importRequest([
                { title: 'Live', status: 'published' },
                { title: 'Locked', status: 'draft', isProtected: true },
            ]),
        );
        const result = (await response.json()) as { warnings: Array<{ slug: string }> };

        const calls = vi.mocked(Post.create).mock.calls.map(([data]) => data as Record<string, unknown>);
        expect(calls.map((data) => data.status)).toEqual(['draft', 'draft']);
        expect(result.warnings.map((warning) => warning.slug)).toEqual(['live', 'locked']);
        for (const data of calls) {
            expect(data).not.toHaveProperty('isProtected');
            expect(data).not.toHaveProperty('passwordHash');
        }
    });

    it('links taxonomy only for callers who may manage it, reusing terms and de-duplicating links', async () => {
        const taxonomyAdmin = { ...editorContext, permissions: ['posts:create', 'taxonomy:manage'] };
        vi.mocked(PostTag.first).mockResolvedValueOnce(record({ id: 't-existing' }) as any);
        vi.mocked(PostCategory.create).mockResolvedValueOnce(record({ id: 'c-new' }) as any);
        const handlers = createBlogHandlers<Env>(configFor(taxonomyAdmin));

        await handlers.handleBlogImport(
            importRequest([{ title: 'Tagged', tags: ['Travel', 'travel'], categories: ['Notes'] }]),
        );

        expect(PostTag.create).not.toHaveBeenCalled();
        expect(PostTagLink.create).toHaveBeenCalledTimes(1);
        expect(PostTagLink.create).toHaveBeenCalledWith({ postId: 'id-tagged', tagId: 't-existing' });
        expect(PostCategory.create).toHaveBeenCalledWith(
            // The caller's own blog vocabulary.
            expect.objectContaining({ name: 'Notes', appId: 'test-app', type: 'post', organizationId: 'org-1' }),
        );
        expect(PostCategoryLink.create).toHaveBeenCalledWith({ postId: 'id-tagged', categoryId: 'c-new' });

        vi.mocked(PostTagLink.create).mockClear();
        const plainHandlers = createBlogHandlers<Env>(configFor(editorContext));
        const response = await plainHandlers.handleBlogImport(importRequest([{ title: 'Second', tags: ['Travel'] }]));
        const result = (await response.json()) as { created: unknown[]; warnings: Array<{ message: string }> };
        expect(result.created).toHaveLength(1);
        expect(result.warnings[0].message).toMatch(/taxonomy:manage/);
        expect(PostTagLink.create).not.toHaveBeenCalled();
    });

    it('rejects oversized batches and reports malformed items without writing them', async () => {
        const handlers = createBlogHandlers<Env>(configFor(editorContext));
        const tooMany = Array.from({ length: 11 }, (_, i) => ({ title: `Post ${i}` }));
        expect((await handlers.handleBlogImport(importRequest(tooMany))).status).toBe(400);

        const response = await handlers.handleBlogImport(
            importRequest([{ title: 42 }, { title: 'Bad status', status: 'live' }, 'nope']),
        );
        const result = (await response.json()) as { skipped: Array<{ reason: string }> };
        expect(result.skipped.map((item) => item.reason)).toEqual([
            'title must be a string',
            'Unknown status "live"',
            'Each post must be an object',
        ]);
        expect(Post.create).not.toHaveBeenCalled();
    });
});
