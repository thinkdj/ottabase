import type { RateLimitConfig, RateLimitResult } from "./types";

/**
 * Extract client IP from request headers
 * Cloudflare sets CF-Connecting-IP header with the real client IP
 */
export function getClientIP(request: Request): string {
  // Cloudflare provides the real IP in CF-Connecting-IP
  const cfIP = request.headers.get("CF-Connecting-IP");
  if (cfIP) return cfIP;

  // Fallback to X-Forwarded-For (parse first IP)
  const xForwardedFor = request.headers.get("X-Forwarded-For");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  // Fallback to X-Real-IP
  const xRealIP = request.headers.get("X-Real-IP");
  if (xRealIP) return xRealIP;

  // Default fallback (should not happen on Cloudflare)
  return "unknown";
}

/**
 * Check if request should bypass rate limiting
 */
export function shouldBypassRateLimit(
  request: Request,
  config: RateLimitConfig
): boolean {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Check excluded paths
  if (config.excludePaths) {
    for (const path of config.excludePaths) {
      if (pathname === path || pathname.startsWith(path + "/")) {
        return true;
      }
    }
  }

  // Check included paths (if specified, only these are limited)
  if (config.includePaths && config.includePaths.length > 0) {
    let shouldLimit = false;
    for (const path of config.includePaths) {
      if (pathname === path || pathname.startsWith(path + "/")) {
        shouldLimit = true;
        break;
      }
    }
    if (!shouldLimit) return true;
  }

  // Check authentication bypass
  if (config.bypassAuthenticated) {
    const authHeader = config.authHeader || "authorization";
    const hasAuth = request.headers.has(authHeader);
    if (hasAuth) return true;
  }

  return false;
}

/**
 * Check rate limit with Durable Object
 */
export async function checkRateLimit(
  request: Request,
  env: any,
  config: RateLimitConfig = {}
): Promise<RateLimitResult> {
  // Check if should bypass
  if (shouldBypassRateLimit(request, config)) {
    return {
      allowed: true,
      count: 0,
      limit: config.dailyLimit || 100,
      remaining: config.dailyLimit || 100,
      resetAt: Date.now() + 86400000, // 24 hours
    };
  }

  // Get client IP
  const ip = getClientIP(request);

  // Get Durable Object stub
  const id = env.RATE_LIMITER.idFromName(ip);
  const stub = env.RATE_LIMITER.get(id);

  // Create request to DO
  const doRequest = new Request("https://do.internal/hit", {
    method: "POST",
    headers: config.dailyLimit
      ? { "X-Rate-Limit-Max": String(config.dailyLimit) }
      : {},
  });

  // Call DO
  const response = await stub.fetch(doRequest);
  const result: RateLimitResult = await response.json();

  return result;
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  };
}

/**
 * Create a 429 rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const resetDate = new Date(result.resetAt);
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `You have exceeded the rate limit of ${result.limit} requests per day. Please try again after ${resetDate.toISOString()}.`,
      limit: result.limit,
      remaining: 0,
      resetAt: result.resetAt,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        ...createRateLimitHeaders(result),
      },
    }
  );
}
