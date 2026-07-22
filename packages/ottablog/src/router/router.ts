/**
 * The canonical blog route table, as an @ottabase/ottarouter sub-router.
 *
 * Two entry points:
 * - `createBlogRouter(config)` — one call for a new app: builds handlers from
 *   config and registers the table. Mount it wherever you like:
 *   `apiRouter.mount('/api/blog', createBlogRouter(cfg), { when: gate })`.
 * - `buildBlogRouter(handlers, options)` — registers the same table over an
 *   app-supplied handlers object. otta-web uses this so its handler module
 *   stays the seam for tests/mocks while the route table lives here, once.
 */
import { Router, type Ctx } from '@ottabase/ottarouter';
import { createBlogHandlers } from './handlers';
import type { BlogHandlers, BlogRequestContext, BlogRouterConfig } from './types';

export interface BuildBlogRouterOptions<Env> {
    /**
     * Build the context passed to handlers from the ottarouter Ctx. Defaults to
     * the minimal `{ request, env, url }`. Apps with a richer request context
     * (e.g. otta-web's ApiRouteContext with CORS helpers) supply their own factory;
     * anything structurally extending {@link BlogRequestContext} is accepted.
     */
    makeContext?: (c: Ctx<Env>) => BlogRequestContext<Env>;
}

function defaultMakeContext<Env>(c: Ctx<Env>): BlogRequestContext<Env> {
    return { request: c.req, env: c.env, url: c.url };
}

/** Register the canonical blog route table over the given handlers. */
export function buildBlogRouter<Env = unknown>(
    handlers: BlogHandlers<Env>,
    options?: BuildBlogRouterOptions<Env>,
): Router<Env> {
    const ctxOf = options?.makeContext ?? defaultMakeContext<Env>;
    const r = new Router<Env>();

    r.get('/studio/state', (c) => handlers.handleBlogStudioState(ctxOf(c)));
    r.get('/rss', (c) => handlers.handleBlogRssFeed(ctxOf(c)));
    r.get('/sitemap.xml', (c) => handlers.handleBlogSitemap(ctxOf(c)));
    r.get('/posts', (c) => handlers.handleBlogPostsList(ctxOf(c)));
    r.get('/posts/:postId/related', (c) => handlers.handleBlogRelatedPosts(ctxOf(c), c.params.postId));
    r.get('/posts/by-slug/:slug', (c) => handlers.handleBlogPostBySlug(ctxOf(c), c.params.slug));
    r.get('/tags/by-slug/:slug', (c) => handlers.handleBlogTagBySlug(ctxOf(c), c.params.slug));
    r.get('/categories/by-slug/:slug', (c) => handlers.handleBlogCategoryBySlug(ctxOf(c), c.params.slug));
    r.get('/series/by-slug/:slug', (c) => handlers.handleBlogSeriesBySlug(ctxOf(c), c.params.slug));
    r.post('/studio/theme/activate', (c) => handlers.handleBlogStudioActivateTheme(ctxOf(c)));
    r.post('/studio/plugin/enable', (c) => handlers.handleBlogStudioPluginEnable(ctxOf(c)));
    r.post('/studio/plugin/config', (c) => handlers.handleBlogStudioPluginConfig(ctxOf(c)));
    r.post('/posts/unlock', (c) => handlers.handleBlogPostUnlock(ctxOf(c)));
    r.post('/publish-scheduled', (c) => handlers.handleBlogPublishScheduled(ctxOf(c)));
    r.post('/kitchensink', (c) => handlers.handleBlogKitchensink(ctxOf(c)));

    return r;
}

/** Build handlers from config and register the canonical route table — the one-call entry for new apps. */
export function createBlogRouter<Env = unknown>(
    config: BlogRouterConfig<Env>,
    options?: BuildBlogRouterOptions<Env>,
): Router<Env> {
    return buildBlogRouter(createBlogHandlers(config), options);
}
