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
