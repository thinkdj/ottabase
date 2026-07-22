import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBlogRouter, createBlogHandlers } from '../router';
import type { BlogHandlers } from '../router';

// Model layer is mocked so handler tests can assert on query shapes without a DB.
// Router-table tests below use stub handlers and never touch these mocks.
vi.mock('../ottaorm-models', () => ({
    Post: {
        first: vi.fn(async () => null),
        where: vi.fn(async () => []),
        paginate: vi.fn(async () => ({ data: [], page: 1, perPage: 15, total: 0, totalPages: 0 })),
        search: vi.fn(async () => []),
        find: vi.fn(async () => null),
        related: vi.fn(async () => []),
        publishScheduled: vi.fn(async () => []),
        findBySlug: vi.fn(async () => null),
        create: vi.fn(),
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
        handleBlogPostBySlug: named('post-by-slug'),
        handleBlogPostUnlock: named('post-unlock'),
        handleBlogTagBySlug: named('tag-by-slug'),
        handleBlogCategoryBySlug: named('category-by-slug'),
        handleBlogSeriesBySlug: named('series-by-slug'),
        handleBlogRelatedPosts: named('related'),
        handleBlogRssFeed: named('rss'),
        handleBlogSitemap: named('sitemap'),
        handleBlogPublishScheduled: named('publish-scheduled'),
        handleBlogKitchensink: named('kitchensink'),
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
            ['GET', '/posts/p1/related', 'related'],
            ['GET', '/tags/by-slug/t', 'tag-by-slug'],
            ['GET', '/categories/by-slug/c', 'category-by-slug'],
            ['GET', '/series/by-slug/s', 'series-by-slug'],
            ['POST', '/studio/theme/activate', 'theme-activate'],
            ['POST', '/studio/plugin/enable', 'plugin-enable'],
            ['POST', '/studio/plugin/config', 'plugin-config'],
            ['POST', '/posts/unlock', 'post-unlock'],
            ['POST', '/publish-scheduled', 'publish-scheduled'],
            ['POST', '/kitchensink', 'kitchensink'],
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

    it('publish-scheduled rejects with 401 before touching the database when cron auth fails', async () => {
        const connect = vi.fn(() => null);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, connect, checkCronAuth: () => false });

        const response = await handlers.handleBlogPublishScheduled(ctxFor('/publish-scheduled', { method: 'POST' }));

        expect(response.status).toBe(401);
        expect(connect).not.toHaveBeenCalled();
    });

    it('kitchensink responds 404 when no content is configured', async () => {
        const handlers = createBlogHandlers<Env>({ ...baseConfig });
        const response = await handlers.handleBlogKitchensink(ctxFor('/kitchensink', { method: 'POST' }));
        expect(response.status).toBe(404);
    });

    it('kitchensink returns the admin denial response untouched', async () => {
        const denial = new Response('nope', { status: 403 });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireAdmin: async () => denial });

        const response = await handlers.handleBlogKitchensink(ctxFor('/kitchensink', { method: 'POST' }));
        expect(response).toBe(denial);
    });

    it('propagates the connect error response from data routes', async () => {
        const dbError = new Response('no d1', { status: 500 });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, connect: () => dbError });

        const response = await handlers.handleBlogPostsList(ctxFor('/posts'));
        expect(response).toBe(dbError);
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
