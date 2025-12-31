/**
 * Shared types for Cloudflare Worker route handlers
 */

/** Context passed to every route handler */
export interface RouteContext {
  request: Request;
  env: CloudflareEnv;
  url: URL;
  /** Matched route parameters (e.g., { id: "123" } for /users/:id) */
  params: Record<string, string>;
}

/** A route handler function */
export type RouteHandler = (ctx: RouteContext) => Promise<Response> | Response;

/** Route definition with path pattern and handlers by method */
export interface RouteDefinition {
  /** Path pattern - supports :param for dynamic segments */
  path: string;
  /** Handlers by HTTP method */
  handlers: Partial<Record<HttpMethod, RouteHandler>>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

/** Module that exports route definitions */
export interface RouteModule {
  routes: RouteDefinition[];
}
