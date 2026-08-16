import { beforeEach, describe, expect, it, vi } from 'vitest';
import { globalRLS } from '@ottabase/ottaorm';
import { buildBlogRouter, createBlogHandlers } from '../router';
import type { BlogHandlers } from '../router';
import { BlurbValidationError } from '../types';

// Model layer is mocked so handler tests can assert on query shapes without a DB.
// Router-table tests below use stub handlers and never touch these mocks.
vi.mock('../ottaorm-models', () => ({
    Post: {
        entity: 'posts',
        first: vi.fn(async () => null),
        where: vi.fn(async () => []),
        paginate: vi.fn(async () => ({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 })),
        search: vi.fn(async () => []),
        find: vi.fn(async () => null),
        related: vi.fn(async () => []),
        publishScheduled: vi.fn(async () => []),
        findBySlug: vi.fn(async () => null),
        create: vi.fn(),
        createBlurb: vi.fn(),
        createPhotoJournal: vi.fn(),
    },
    PostCategory: { find: vi.fn(async () => null), findBySlug: vi.fn(async () => null) },
    PostCategoryLink: { where: vi.fn(async () => []) },
    PostSeries: { find: vi.fn(async () => null), findBySlug: vi.fn(async () => null) },
    PostTag: { findBySlug: vi.fn(async () => null) },
    PostTagLink: { where: vi.fn(async () => []) },
    OttablogTheme: { create: vi.fn(), findByThemeId: vi.fn(async () => null), where: vi.fn(async () => []) },
    OttablogPlugin: { create: vi.fn(), findByPluginId: vi.fn(async () => null), where: vi.fn(async () => []) },
}));

vi.mock('../studio', () => ({
    StudioManager: {
        getState: vi.fn(async () => ({ activeThemeId: null, themes: [{ themeId: 'default' }], plugins: [{}] })),
        initialize: vi.fn(async () => undefined),
    },
}));

import { Post, PostTag } from '../ottaorm-models';
import { StudioManager } from '../studio';

type Env = { marker: string };

const named = (name: string) => vi.fn(async () => new Response(name));

function stubHandlers(): BlogHandlers<Env> {
    return {
        handleBlogStudioState: named('studio-state'),
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
        handleBlogSeriesBySlug: named('series-by-slug'),
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
            ['GET', '/rss', 'rss'],
            ['GET', '/sitemap.xml', 'sitemap'],
            ['GET', '/posts', 'posts-list'],
            ['POST', '/blurbs', 'blurb-create'],
            ['PATCH', '/blurbs/p1', 'blurb-update'],
            ['POST', '/photo-journals', 'photo-journal-create'],
            ['PATCH', '/photo-journals/p1', 'photo-journal-update'],
            ['GET', '/posts/p1/related', 'related'],
            ['GET', '/tags/by-slug/t', 'tag-by-slug'],
            ['GET', '/categories/by-slug/c', 'category-by-slug'],
            ['GET', '/series/by-slug/s', 'series-by-slug'],
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
        // The lock screen still needs something to show.
        expect(body.title).toBe('Locked');
        expect(body.excerpt).toBe('Teaser stays public');
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

    describe('platform mode (default)', () => {
        it('adds no organizationId filter and never calls resolveOrganizationId', async () => {
            const resolveOrganizationId = vi.fn(async () => 'org-1');
            const handlers = createBlogHandlers<Env>({ ...baseConfig, resolveOrganizationId });

            await handlers.handleBlogPostsList(ctxFor('/posts'));

            expect(resolveOrganizationId).not.toHaveBeenCalled();
            const where = vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;
            expect('organizationId' in where).toBe(false);
        });

        it('always scopes the public list to the resolved app (shared-DB multi-app safety)', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });

            // No ?appId → falls back to the app's configured default.
            await handlers.handleBlogPostsList(ctxFor('/posts'));
            let where = vi.mocked(Post.paginate).mock.calls.at(-1)![2] as Record<string, unknown>;
            expect(where.appId).toBe('test-app');

            // Explicit ?appId still wins.
            await handlers.handleBlogPostsList(ctxFor('/posts?appId=other-app'));
            where = vi.mocked(Post.paginate).mock.calls.at(-1)![2] as Record<string, unknown>;
            expect(where.appId).toBe('other-app');
        });

        it('scopes related posts to the resolved app', async () => {
            const handlers = createBlogHandlers<Env>({ ...baseConfig });
            vi.mocked(Post.first).mockResolvedValueOnce({ get: () => 'blog' } as any);

            await handlers.handleBlogRelatedPosts(ctxFor('/posts/p1/related'), 'p1');

            expect(Post.related).toHaveBeenCalledWith('p1', expect.objectContaining({ appId: 'test-app' }));
            expect(Post.first).toHaveBeenCalledWith({ id: 'p1', appId: 'test-app' });
        });
    });

    describe('org mode', () => {
        const orgConfig = {
            ...baseConfig,
            mode: 'org' as const,
            resolveOrganizationId: vi.fn(async () => 'org-1'),
        };

        it('scopes the public posts list to the resolved organization', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            await handlers.handleBlogPostsList(ctxFor('/posts'));

            const where = vi.mocked(Post.paginate).mock.calls[0][2] as Record<string, unknown>;
            expect(where.organizationId).toBe('org-1');
        });

        it('scopes by-slug lookups to the resolved organization', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/hello'), 'hello');

            expect(Post.first).toHaveBeenCalledWith(
                expect.objectContaining({ slug: 'hello', status: 'published', organizationId: 'org-1' }),
            );
        });

        it('falls back to platform-owned content (organizationId null) when no tenant resolves', async () => {
            const handlers = createBlogHandlers<Env>({
                ...orgConfig,
                resolveOrganizationId: vi.fn(async () => null),
            });
            await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/hello'), 'hello');

            expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ organizationId: null }));
        });

        it('threads the organization into taxonomy lookups', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            await handlers.handleBlogTagBySlug(ctxFor('/tags/by-slug/t'), 't');

            expect(PostTag.findBySlug).toHaveBeenCalledWith('t', expect.objectContaining({ organizationId: 'org-1' }));
        });

        it('threads the organization into studio state', async () => {
            const handlers = createBlogHandlers<Env>(orgConfig);
            await handlers.handleBlogStudioState(ctxFor('/studio/state'));

            expect(StudioManager.getState).toHaveBeenCalledWith('test-app', 'org-1');
        });

        it('resolves the mode per request when mode is a function of env', async () => {
            const seenModes: string[] = [];
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                mode: (e) => {
                    seenModes.push(e.marker);
                    return 'platform';
                },
            });

            await handlers.handleBlogPostsList({ ...ctxFor('/posts'), env: { marker: 'env-a' } });
            await handlers.handleBlogPostsList({ ...ctxFor('/posts'), env: { marker: 'env-b' } });

            expect(seenModes).toEqual(['env-a', 'env-b']);
        });
    });

    describe('scoped studio guard', () => {
        it('guards mutations against the RESOLVED tenant (org mode) and propagates denial', async () => {
            const denial = new Response('not-your-blog', { status: 403 });
            const requireScopedStudioAdmin = vi.fn(async () => denial);
            const handlers = createBlogHandlers<Env>({
                ...baseConfig,
                mode: 'org' as const,
                resolveOrganizationId: vi.fn(async () => 'org-1'),
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

        it('maps the platform blog (unresolved tenant and platform mode) to a null target', async () => {
            const requireScopedStudioAdmin = vi.fn(async () => ({ session: null }));

            // Org mode, apex (tenant resolves null) → platform blog target.
            const orgHandlers = createBlogHandlers<Env>({
                ...baseConfig,
                mode: 'org' as const,
                resolveOrganizationId: vi.fn(async () => null),
                requireScopedStudioAdmin,
            });
            await orgHandlers.handleBlogStudioThemeTokens(
                ctxFor('/studio/theme/tokens', { method: 'POST', body: JSON.stringify({ themeId: 't' }) }),
            );
            expect(requireScopedStudioAdmin).toHaveBeenLastCalledWith(expect.anything(), { organizationId: null });

            // Platform mode (tenant undefined) → also the null target.
            const platformHandlers = createBlogHandlers<Env>({ ...baseConfig, requireScopedStudioAdmin });
            await platformHandlers.handleBlogStudioPluginEnable(
                ctxFor('/studio/plugin/enable', { method: 'POST', body: JSON.stringify({ pluginId: 'p' }) }),
            );
            expect(requireScopedStudioAdmin).toHaveBeenLastCalledWith(expect.anything(), { organizationId: null });
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
            // No seeding needed and no ?full=1 → the admin guard is never consulted.
            expect(requireAdmin).not.toHaveBeenCalled();
        });

        it('serves the full payload only to admins that request ?full=1', async () => {
            vi.mocked(StudioManager.getState).mockResolvedValue(fullState as any);

            const adminHandlers = createBlogHandlers<Env>({
                ...baseConfig,
                requireAdmin: vi.fn(async () => ({ session: null })),
            });
            const adminBody = (await (
                await adminHandlers.handleBlogStudioState(ctxFor('/studio/state?full=1'))
            ).json()) as typeof fullState;
            expect(adminBody.themes.map((t) => t.themeId)).toEqual(['default', 'stash']);
            expect(adminBody.plugins.find((p) => p.pluginId === 'off')?.config).toEqual({ b: 2 });

            const anonHandlers = createBlogHandlers<Env>({
                ...baseConfig,
                requireAdmin: vi.fn(async () => new Response('no', { status: 401 })),
            });
            const anonBody = (await (
                await anonHandlers.handleBlogStudioState(ctxFor('/studio/state?full=1'))
            ).json()) as typeof fullState;
            expect(anonBody.themes.map((t) => t.themeId)).toEqual(['default']);
            expect(anonBody.plugins.find((p) => p.pluginId === 'off')?.config).toBeNull();
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

        it('org mode: the token binds the POST ROW org, not the request org hint', async () => {
            const handlers = createBlogHandlers<Env>({
                ...previewConfig,
                mode: 'org' as const,
                resolveOrganizationId: vi.fn(async () => 'org-request-hint'),
                canManagePost: vi.fn(async () => true),
            });
            vi.mocked(Post.first).mockResolvedValueOnce(
                ownPostRow('draft', { authorId: 'someone-else', organizationId: 'org-real' }),
            );

            const response = await handlers.handleBlogPreviewTokenMint(
                ctxFor('/posts/preview-token', { method: 'POST', body: JSON.stringify({ slug: 'draft' }) }),
            );
            expect(response.status).toBe(200);
            const { token } = (await response.json()) as { token: string };

            const { verifyPreviewToken } = await import('../preview-token');
            const payload = await verifyPreviewToken(SECRET, token);
            expect(payload?.organizationId).toBe('org-real');
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
            expect(path).toContain('preview=');

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
    });
});

describe('org-mode migrations', () => {
    it('executes idempotent index statements through executeRaw', async () => {
        const executed: string[] = [];
        const db = { executeRaw: vi.fn(async (sql: string) => void executed.push(sql)) };

        const { ottablogOrgModeMigrations } = await import('../migrations');
        expect(ottablogOrgModeMigrations).toHaveLength(1);
        await ottablogOrgModeMigrations[0].up(db);

        // Every statement is idempotent, and each swapped table gets a NULL-org partial
        // pair (SQLite unique indexes treat NULLs as distinct).
        expect(executed.length).toBeGreaterThan(0);
        for (const sql of executed) {
            expect(sql).toMatch(/IF (NOT )?EXISTS/);
        }
        const dropped = executed.filter((s) => s.startsWith('DROP INDEX'));
        expect(dropped).toHaveLength(6);
        const nullPartials = executed.filter((s) => s.includes('WHERE organization_id IS NULL'));
        expect(nullPartials).toHaveLength(6);
    });
});
