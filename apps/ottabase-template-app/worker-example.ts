/**
 * Example Cloudflare Worker that exports the RateLimitDO Durable Object
 *
 * This file demonstrates how to integrate the rate limiter with your Worker.
 *
 * Deploy this with: wrangler deploy
 *
 * Note: For Next.js on Cloudflare Pages, the middleware.ts file handles
 * rate limiting automatically. This file is only needed if you're using
 * a standalone Worker or want direct access to the Durable Object.
 */

export { RateLimitDO } from "@ottabase/cf-ratelimiter/durable-object";

// Example Worker fetch handler
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Your Worker logic here
    // The rate limiting is handled in middleware.ts for Next.js

    return new Response("Hello from Ottabase!", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
