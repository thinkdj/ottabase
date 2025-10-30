import { withRateLimit } from "@ottabase/cf-ratelimiter/middleware";

/**
 * Next.js Edge Middleware with Cloudflare Rate Limiting
 *
 * This middleware uses Cloudflare Durable Objects to enforce:
 * - 100 requests per day per IP (configurable)
 * - Daily reset at midnight UTC
 * - Bypasses authenticated users
 *
 * Note: Also configure Cloudflare Rate Limiting rule (10 req/min) in
 * the dashboard for burst protection at the network edge.
 */
export default withRateLimit({
  dailyLimit: 100,
  bypassAuthenticated: true,
  authHeader: "authorization",
  excludePaths: [
    // Next.js internals
    "/_next",
    "/api/health",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ],
  // Optional: Only limit specific paths
  // includePaths: ['/api/public'],
});

/**
 * Middleware matcher configuration
 * Only apply to API routes
 */
export const config = {
  matcher: "/api/:path*",
};
