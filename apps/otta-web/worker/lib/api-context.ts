// ============================================================
// The request context every route handler receives, and the adapters that build it
// ============================================================
// Lives apart from the router so package manifests (ottabase/packages/*.ts) can adapt
// their handlers without importing the router module, which imports them.
// ============================================================

import { withHeaders, type Ctx } from '@ottabase/ottarouter';

/** The context every route handler receives. */
export interface ApiRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    route: string;
    method: string;
    withAuthCors: (response: Response) => Response;
    corsHeaders: Record<string, string>;
}

export type WorkerCtx = Ctx<CloudflareEnv>;
export type ApiHandler = (context: ApiRouteContext) => Promise<Response | null> | Response | null;

export function buildCorsHeaders(request: Request, env: CloudflareEnv): Record<string, string> {
    // Never reflect an arbitrary Origin together with credentials. Doing so lets any site
    // issue credentialed cross-origin reads (e.g. GET /api/auth/csrf, which would leak the
    // CSRF token, or GET /api/auth/session, which would leak session data). Only echo the
    // Origin when it is same-origin, matches the configured AUTH_URL, or is in the
    // CORS_ALLOWED_ORIGINS allowlist; otherwise omit Access-Control-Allow-Origin so the
    // browser blocks the cross-origin read.
    const cfg = env as { AUTH_URL?: string; CORS_ALLOWED_ORIGINS?: string };
    const requestOrigin = request.headers.get('Origin');
    const allowedOrigins = new Set<string>();
    try {
        allowedOrigins.add(new URL(request.url).origin);
    } catch {
        /* ignore */
    }
    for (const candidate of [cfg.AUTH_URL, ...String(cfg.CORS_ALLOWED_ORIGINS || '').split(',')]) {
        const trimmed = (candidate || '').trim();
        if (!trimmed) continue;
        try {
            allowedOrigins.add(new URL(trimmed).origin);
        } catch {
            /* ignore malformed configured origin */
        }
    }
    const corsOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : null;
    return corsOrigin
        ? {
              'Access-Control-Allow-Origin': corsOrigin,
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
              Vary: 'Origin',
          }
        : { Vary: 'Origin' };
}

export function makeApiRouteContext(
    request: Request,
    env: CloudflareEnv,
    url: URL = new URL(request.url),
): ApiRouteContext {
    const corsHeaders = buildCorsHeaders(request, env);
    const route = url.pathname !== '/' && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    return {
        request,
        env,
        url,
        route,
        method: request.method,
        corsHeaders,
        withAuthCors: (response) => withHeaders(response, corsHeaders),
    };
}

/** The handler context for an ottarouter `Ctx`. */
export const ctxOf = (c: WorkerCtx): ApiRouteContext => makeApiRouteContext(c.req, c.env, c.url);

/** Adapt an `ApiHandler` (takes an `ApiRouteContext`) to an ottarouter handler. */
export const h =
    (handler: ApiHandler) =>
    (c: WorkerCtx): Promise<Response | null> | Response | null =>
        handler(ctxOf(c));
