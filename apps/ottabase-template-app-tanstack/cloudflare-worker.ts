/**
 * Cloudflare Worker Entry Point
 *
 * This is the main entry point for the Cloudflare Worker.
 * Routes are organized in separate modules under worker/routes/ and loaded lazily
 * to minimize cold start time and only load what's needed per request.
 *
 * Architecture:
 * - worker/router.ts       - Lightweight router with path matching
 * - worker/types.ts        - Shared type definitions
 * - worker/utils/          - Utility functions (response helpers, auth)
 * - worker/routes/         - Route handlers organized by domain
 *   ├── health.ts          - Health check
 *   ├── cloudflare/        - Cloudflare service demos (KV, R2, D1, etc.)
 *   └── ottaorm/           - OttaORM demo APIs
 */

import { RealtimeActor } from "@ottabase/cf-realtime/server";
import { createRouter } from "./worker/router";
import { isHtmlRequest } from "./worker/utils/response";

// Re-export Durable Object class for Cloudflare
export { RealtimeActor };

// Create router with lazy-loaded route modules
const router = createRouter()
  // Static routes (always loaded - minimal overhead)
  .static([
    {
      path: "/api/health",
      handlers: {
        GET: () => Response.json({ ok: true, name: "ottabase-template-app-tanstack" }),
      },
    },
  ])
  // Lazy-loaded route modules - only imported when path prefix matches
  .lazy("/api/cloudflare/kv", () => import("./worker/routes/cloudflare/kv"))
  .lazy("/api/cloudflare/r2", () => import("./worker/routes/cloudflare/r2"))
  .lazy("/api/cloudflare/d1", () => import("./worker/routes/cloudflare/d1"))
  .lazy("/api/cloudflare/queues", () => import("./worker/routes/cloudflare/queues"))
  .lazy("/api/cloudflare/rate-limiting", () => import("./worker/routes/cloudflare/rate-limiting"))
  .lazy("/api/cloudflare/realtime", () => import("./worker/routes/cloudflare/realtime"))
  .lazy("/api/ottaorm/init", () => import("./worker/routes/ottaorm/init"))
  .lazy("/api/ottaorm/users", () => import("./worker/routes/ottaorm/users"))
  .lazy("/api/ottaorm/posts", () => import("./worker/routes/ottaorm/posts"));

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    // Try to match a route
    const response = await router.handle(request, env);
    if (response) return response;

    // Serve built assets. If the asset isn't found and the client is requesting HTML,
    // fall back to `index.html` to support client-side routing.
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || !isHtmlRequest(request)) {
      return assetResponse;
    }

    const url = new URL(request.url);
    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
