import { RealtimeActor } from '@ottabase/cf-realtime/server';
import type { QueuedJob } from '@ottabase/queue';
import { errorResponse } from '@ottabase/utils/http-errors';
import { handleAppScheduled } from './ottabase/cron';
import { queueHandler } from './ottabase/queue';
import {
    handleBootstrapRoute,
    interceptIfNotReady,
    invalidatePlatformStateCache,
    resolvePlatformState,
} from './worker/bootstrap';
import { injectBlogPostSeo } from './worker/lib/blog-seo-inject';
import { injectBlogThemeCss } from './worker/lib/blog-theme-inject';
import { injectBrandCriticalCSS } from './worker/lib/brand-html-inject';
import { ensureDbConnection } from './worker/lib/db-utils';
import { handleUnhandledRequestError } from './worker/lib/http-error-boundary';
import { checkKillSwitches } from './worker/lib/killswitch';
import { handleApiRequest } from './worker/routes/router';
import { handleShortlinkFallback } from './worker/routes/shortlinks';
export { WebhookEndpointQuota } from './worker/durable-objects/WebhookEndpointQuota';

export { RealtimeActor };

const SPA_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function normalizePath(path: string): string {
    if (path !== '/' && path.endsWith('/')) {
        return path.slice(0, -1);
    }
    return path;
}

function isHtmlRequest(request: Request): boolean {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
        return false;
    }

    const accept = request.headers.get('Accept');
    return !!accept && accept.includes('text/html');
}

/** Rebuild an inbound request without edge-only `cf` metadata for the Assets service binding. */
function createAssetRequest(request: Request, url: string | URL = request.url): Request {
    return new Request(url, {
        method: request.method,
        headers: request.headers,
        redirect: request.redirect,
    });
}

export default {
    async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
        try {
            const url = new URL(request.url);
            const normalizedPathname = normalizePath(url.pathname);

            // -------------------------------------------------------
            // Global kill switches
            // -------------------------------------------------------
            const killed = checkKillSwitches(request, env);
            if (killed) return killed;

            // -------------------------------------------------------
            // Bootstrap gate – resolve platform state before anything
            // -------------------------------------------------------

            // /__bootstrap__/* routes always drop the isolate READY memo and
            // resolve fresh. The finally-invalidate matters: the pre-handler
            // resolve re-arms the memo (KV may still say READY), and the route
            // may then mutate platform state — never leave that memo armed
            // across the transition. (State writers also invalidate directly.)
            if (normalizedPathname.startsWith('/__bootstrap__')) {
                invalidatePlatformStateCache();
                try {
                    return await handleBootstrapRoute({
                        request,
                        env,
                        url,
                        platformState: await resolvePlatformState(env),
                    });
                } finally {
                    invalidatePlatformStateCache();
                }
            }

            const platformState = await resolvePlatformState(env);

            // Block non-bootstrap requests if platform is not READY
            const intercepted = interceptIfNotReady(request, url, platformState);
            if (intercepted) {
                return intercepted;
            }

            // -------------------------------------------------------
            // Normal request flow — platform is READY
            // -------------------------------------------------------
            const requiresDbConnection = normalizedPathname.startsWith('/api/') || isHtmlRequest(request);
            if (requiresDbConnection) {
                ensureDbConnection(env);
            }

            // API routes (built-ins, then user-zone custom routes) — null falls through
            const apiResponse = await handleApiRequest(request, env, ctx);

            if (apiResponse) {
                return apiResponse;
            }

            const shortlinkFallbackResponse = await handleShortlinkFallback({ request, env, url });
            if (shortlinkFallbackResponse) {
                return shortlinkFallbackResponse;
            }

            if (!env.OBCF_ASSETS) {
                return errorResponse('Assets binding not configured', 500, {
                    code: 'CONFIG_ERROR',
                });
            }

            let response = await env.OBCF_ASSETS.fetch(createAssetRequest(request));

            if (isHtmlRequest(request) && (response.status === 404 || SPA_REDIRECT_STATUSES.has(response.status))) {
                const indexUrl = new URL(request.url);
                // Fetch the root '/' instead of '/index.html' because Cloudflare Assets natively
                // redirects '/index.html' to '/' (308), which strips the SPA path in the browser.
                indexUrl.pathname = '/';
                response = await env.OBCF_ASSETS.fetch(createAssetRequest(request, indexUrl));
            }

            if (isHtmlRequest(request) && response.ok) {
                response = await injectBrandCriticalCSS(response, request, env);
                // Blog detail navigations additionally get per-post SEO meta
                // (title, description, canonical, OG/Twitter, JSON-LD) so
                // crawlers and unfurlers see the article, not the SPA shell.
                response = await injectBlogPostSeo(response, request, env);
                // Blog documents also get the active blog theme's scoped token
                // CSS ([data-brand-scope="blog"]) so the blog room first-paints
                // themed, matching what the client applies after hydration.
                response = await injectBlogThemeCss(response, request, env);
            }

            return response;
        } catch (err) {
            return handleUnhandledRequestError(err, request);
        }
    },
    scheduled: handleAppScheduled,
    queue: queueHandler,
} satisfies ExportedHandler<CloudflareEnv, QueuedJob<unknown>>;
