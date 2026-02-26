import type { CloudflareEnv } from '../../cloudflare-env';

/**
 * Context passed to every API route handler.
 *
 * Shared between the framework router (`worker/routes/router.ts`)
 * and user-zone custom route handlers (`ottabase/config.routes.ts`).
 *
 * @example
 * ```ts
 * // ottabase/config.routes.ts
 * import type { ApiRouteContext } from '../worker/routes/types';
 *
 * export async function handleCustomRoutes(ctx: ApiRouteContext) {
 *     if (ctx.route === '/api/my-feature' && ctx.method === 'GET') {
 *         return new Response(JSON.stringify({ ok: true }), {
 *             headers: { 'Content-Type': 'application/json', ...ctx.corsHeaders },
 *         });
 *     }
 *     return null;
 * }
 * ```
 */
export interface ApiRouteContext {
    /** The incoming Request object. */
    request: Request;
    /** Cloudflare Worker bindings (D1, KV, R2, env vars, etc.). */
    env: CloudflareEnv;
    /** Parsed URL of the request. */
    url: URL;
    /** Normalized pathname (trailing slash stripped), e.g. `"/api/premium/dashboard"`. */
    route: string;
    /** HTTP method: `"GET"`, `"POST"`, `"PATCH"`, `"PUT"`, `"DELETE"`, etc. */
    method: string;
    /** Adds CORS headers (with credentials) to a Response. */
    withAuthCors: (response: Response) => Response;
    /** Pre-built CORS headers object for use in custom Response constructors. */
    corsHeaders: Record<string, string>;
}

/** A function that handles an API route, returning a Response or null to skip. */
export type RouteHandler = (context: ApiRouteContext) => Promise<Response | null> | Response | null;
