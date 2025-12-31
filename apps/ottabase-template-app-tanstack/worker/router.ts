/**
 * Lightweight router with lazy loading support for Cloudflare Workers
 *
 * Features:
 * - Dynamic imports for code splitting (only loads route handlers when needed)
 * - Path parameter extraction (e.g., /users/:id)
 * - Method-based routing
 */

import type { HttpMethod, RouteContext, RouteDefinition, RouteHandler, RouteModule } from "./types";
import { json, methodNotAllowed } from "./utils/response";

/** Route registration with lazy loader */
interface LazyRoute {
  /** Path prefix for matching (e.g., "/api/cloudflare/kv") */
  pathPrefix: string;
  /** Lazy loader function that returns the route module */
  loader: () => Promise<RouteModule>;
  /** Cached routes after first load */
  _cached?: RouteDefinition[];
}

/** Router instance */
export class Router {
  private lazyRoutes: LazyRoute[] = [];
  private staticRoutes: RouteDefinition[] = [];

  /**
   * Register a lazy-loaded route module
   * The module will only be imported when a matching request arrives
   */
  lazy(pathPrefix: string, loader: () => Promise<RouteModule>): this {
    this.lazyRoutes.push({ pathPrefix, loader });
    return this;
  }

  /** Register static routes (always loaded) */
  static(routes: RouteDefinition[]): this {
    this.staticRoutes.push(...routes);
    return this;
  }

  /** Handle an incoming request */
  async handle(request: Request, env: CloudflareEnv): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method as HttpMethod;

    // Check static routes first
    for (const route of this.staticRoutes) {
      const params = matchPath(route.path, url.pathname);
      if (params !== null) {
        const handler = route.handlers[method];
        if (!handler) return methodNotAllowed();
        return handler({ request, env, url, params });
      }
    }

    // Check lazy routes
    for (const lazyRoute of this.lazyRoutes) {
      if (!url.pathname.startsWith(lazyRoute.pathPrefix)) continue;

      // Load module if not cached
      if (!lazyRoute._cached) {
        const module = await lazyRoute.loader();
        lazyRoute._cached = module.routes;
      }

      // Match against loaded routes
      for (const route of lazyRoute._cached) {
        const params = matchPath(route.path, url.pathname);
        if (params !== null) {
          const handler = route.handlers[method];
          if (!handler) return methodNotAllowed();
          return handler({ request, env, url, params });
        }
      }
    }

    return null; // No match
  }
}

/**
 * Match a path pattern against a URL pathname
 * Returns params object if matched, null otherwise
 *
 * Supports:
 * - Exact matches: "/api/health" matches "/api/health"
 * - Parameters: "/api/users/:id" matches "/api/users/123" -> { id: "123" }
 * - Wildcards: "/api/files/*" matches "/api/files/a/b/c" -> { "*": "a/b/c" }
 */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    // Wildcard - matches rest of path
    if (patternPart === "*") {
      params["*"] = pathParts.slice(i).join("/");
      return params;
    }

    // No more path parts but pattern expects more
    if (pathPart === undefined) return null;

    // Parameter
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
      continue;
    }

    // Exact match required
    if (patternPart !== pathPart) return null;
  }

  // Ensure all path parts were consumed
  if (pathParts.length !== patternParts.length) return null;

  return params;
}

/** Create a new router instance */
export function createRouter(): Router {
  return new Router();
}
