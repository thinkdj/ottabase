import { RealtimeActor } from '@ottabase/cf-realtime/server';
import { Shortlink } from '@ottabase/shortlinks';
import { errorResponse, ServiceError } from '@ottabase/utils/http-errors';
import type { CloudflareEnv } from './cloudflare-env';
import { ResumeSaved } from './ottabase/models/ResumeSaved';
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

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inject OG meta tags into the HTML response for public resume pages. */
async function injectOgMetaTags(
    response: Response,
    resumeName: string,
    headline: string,
    url: string,
): Promise<Response> {
    const html = await response.text();
    const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(resumeName)} — ResumeMe" />
    <meta property="og:description" content="${escapeHtml(headline || 'Professional resume created with ResumeMe')}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(resumeName)} — ResumeMe" />
    <meta name="twitter:description" content="${escapeHtml(headline || 'Professional resume created with ResumeMe')}" />`;

    const injected = html.replace('</head>', `${ogTags}\n</head>`);
    return new Response(injected, {
        status: response.status,
        headers: response.headers,
    });
}

/**
 * Resolve OG meta data for a /r/:code path by looking up the shortlink and resume.
 * Returns null if lookup fails (page still renders as normal SPA).
 */
async function resolvePublicResumeOgData(code: string): Promise<{ name: string; headline: string } | null> {
    try {
        const shortlink = await Shortlink.findByCode(code);
        if (!shortlink) return null;

        const linkUrl = shortlink.get('fullUrl') as string;
        let resumeId: string | null = null;
        try {
            const parsed = new URL(linkUrl);
            resumeId = parsed.searchParams.get('resumeId');
        } catch {
            return null;
        }
        if (!resumeId) return null;

        const resume = await ResumeSaved.find(resumeId);
        if (!resume) return null;

        const name = (resume.get('name') as string) || 'Resume';
        let headline = '';
        try {
            const snapshot = JSON.parse((resume.get('snapshotData') as string) || '{}');
            headline = snapshot?.profile?.headline || '';
        } catch {
            // ignore parse errors
        }

        return { name, headline };
    } catch {
        return null;
    }
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

            // Shortlink vanity-URL fallback (skips /r/ paths — those are client-side)
            if (!normalizedPathname.startsWith('/r/')) {
                const shortlinkResponse = await handleShortlinkFallback({
                    request,
                    env,
                    url,
                });
                if (shortlinkResponse) {
                    return shortlinkResponse;
                }
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

                // Inject OG meta tags for public resume pages (/r/:code)
                const publicResumeMatch = normalizedPathname.match(/^\/r\/([^/]+)$/);
                if (publicResumeMatch) {
                    const ogData = await resolvePublicResumeOgData(publicResumeMatch[1]);
                    if (ogData) {
                        response = await injectOgMetaTags(response, ogData.name, ogData.headline, url.toString());
                    }
                }
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
