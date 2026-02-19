import { RealtimeActor } from '@ottabase/cf-realtime/server';
import { errorResponse, ServiceError } from '@ottabase/utils/http-errors';
import type { CloudflareEnv } from './cloudflare-env';
import { queueHandler } from './ottabase/queue';
import { handleBootstrapRoute, interceptIfNotReady, resolvePlatformState } from './worker/bootstrap';
import { injectBrandCriticalCSS } from './worker/lib/brand-html-inject';
import { initDbConnection } from './worker/lib/db-utils';
import { checkKillSwitches } from './worker/lib/killswitch';
import { resolveApiRoute } from './worker/routes/router';
import { handleShortlinkFallback } from './worker/routes/shortlinks';

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

export default {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
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
            const platformState = await resolvePlatformState(env);

            // Handle /__bootstrap__/* routes
            if (normalizedPathname.startsWith('/__bootstrap__')) {
                return await handleBootstrapRoute({
                    request,
                    env,
                    url,
                    platformState,
                });
            }

            // Block non-bootstrap requests if platform is not READY
            const intercepted = interceptIfNotReady(request, url, platformState);
            if (intercepted) {
                return intercepted;
            }

            // -------------------------------------------------------
            // Normal request flow — platform is READY
            // -------------------------------------------------------
            initDbConnection(env);

            const origin = request.headers.get('Origin') || '*';
            const route = normalizedPathname;
            const method = request.method;
            const corsHeaders = {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                Vary: 'Origin',
            };
            const withAuthCors = (response: Response) => {
                try {
                    Object.entries(corsHeaders).forEach(([key, value]) => {
                        response.headers.set(key, value);
                    });
                    return response;
                } catch {
                    const headers = new Headers(response.headers);
                    Object.entries(corsHeaders).forEach(([key, value]) => {
                        headers.set(key, value);
                    });
                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers,
                    });
                }
            };

            const apiResponse = await resolveApiRoute({
                request,
                env,
                url,
                route,
                method,
                withAuthCors,
                corsHeaders,
            });

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

            let response = await env.OBCF_ASSETS.fetch(request);

            if (isHtmlRequest(request) && (response.status === 404 || SPA_REDIRECT_STATUSES.has(response.status))) {
                const indexUrl = new URL(request.url);
                indexUrl.pathname = '/index.html';
                response = await env.OBCF_ASSETS.fetch(new Request(indexUrl.toString(), request));
            }

            if (isHtmlRequest(request) && response.ok) {
                response = await injectBrandCriticalCSS(response, request, env);
            }

            return response;
        } catch (err) {
            console.error('Worker unhandled error:', err);

            if (err instanceof ServiceError) {
                return errorResponse(err.message, err.status, err.toApiResponse());
            }

            return errorResponse(err instanceof Error ? err.message : 'An unexpected error occurred', 500, {
                code: 'INTERNAL_SERVER_ERROR',
            });
        }
    },
    queue: queueHandler,
};
