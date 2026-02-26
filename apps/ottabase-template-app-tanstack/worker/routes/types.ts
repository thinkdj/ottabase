import type { CloudflareEnv } from '../../cloudflare-env';

/**
 * Context passed to every API route handler.
 *
 * This type is shared between the framework router and user-zone
 * custom route handlers (`ottabase/config.routes.ts`).
 */
export interface ApiRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    route: string;
    method: string;
    withAuthCors: (response: Response) => Response;
    corsHeaders: Record<string, string>;
}

export type RouteHandler = (context: ApiRouteContext) => Promise<Response | null> | Response | null;
