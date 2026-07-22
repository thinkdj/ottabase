import { describe, expect, it, vi } from 'vitest';
import { buildBlogRouter, createBlogHandlers } from '../router';
import type { BlogHandlers } from '../router';

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

describe('createBlogHandlers (DB-free paths)', () => {
    const baseConfig = {
        connect: vi.fn(() => null),
        defaultAppId: () => 'test-app',
        requireAdmin: vi.fn(async () => ({ session: null })),
        checkCronAuth: vi.fn(() => false),
        verifyPassword: vi.fn(async () => false),
    };

    it('publish-scheduled rejects with 401 before touching the database when cron auth fails', async () => {
        const connect = vi.fn(() => null);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, connect, checkCronAuth: () => false });

        const response = await handlers.handleBlogPublishScheduled({
            request: new Request('https://x.test/publish-scheduled', { method: 'POST' }),
            env,
            url: new URL('https://x.test/publish-scheduled'),
        });

        expect(response.status).toBe(401);
        expect(connect).not.toHaveBeenCalled();
    });

    it('kitchensink responds 404 when no content is configured', async () => {
        const handlers = createBlogHandlers<Env>({ ...baseConfig });

        const response = await handlers.handleBlogKitchensink({
            request: new Request('https://x.test/kitchensink', { method: 'POST' }),
            env,
            url: new URL('https://x.test/kitchensink'),
        });

        expect(response.status).toBe(404);
    });

    it('kitchensink returns the admin denial response untouched', async () => {
        const denial = new Response('nope', { status: 403 });
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireAdmin: async () => denial,
        });

        const response = await handlers.handleBlogKitchensink({
            request: new Request('https://x.test/kitchensink', { method: 'POST' }),
            env,
            url: new URL('https://x.test/kitchensink'),
        });

        expect(response).toBe(denial);
    });

    it('propagates the connect error response from data routes', async () => {
        const dbError = new Response('no d1', { status: 500 });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, connect: () => dbError });

        const response = await handlers.handleBlogPostsList({
            request: new Request('https://x.test/posts'),
            env,
            url: new URL('https://x.test/posts'),
        });

        expect(response).toBe(dbError);
    });
});
