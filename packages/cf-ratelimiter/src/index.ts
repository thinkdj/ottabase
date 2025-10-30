/**
 * @ottabase/cf-ratelimiter
 *
 * Cloudflare Durable Objects-based rate limiter for API protection
 *
 * Features:
 * - 100 requests/day per IP (configurable)
 * - Atomic counting via Durable Objects
 * - Daily reset at midnight UTC
 * - Authentication bypass support
 * - Path-based inclusion/exclusion
 *
 * Note: Also configure Cloudflare Rate Limiting rules (10 req/min) in dashboard
 * for burst protection before requests reach your Worker.
 */

export * from "./types";
export * from "./client";
export { RateLimitDO } from "./durable-object";

// Re-export for convenience
export {
  checkRateLimit,
  getClientIP,
  shouldBypassRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
} from "./client";

export type { RateLimitConfig, RateLimitResult, RateLimitState } from "./types";
