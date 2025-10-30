import { NextRequest, NextResponse } from "next/server";
import type { RateLimitConfig } from "./types";
import {
  checkRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
} from "./client";

/**
 * Next.js Edge Runtime middleware for rate limiting
 *
 * Usage in middleware.ts:
 * ```typescript
 * import { withRateLimit } from '@ottabase/cf-ratelimiter/middleware';
 *
 * export default withRateLimit({
 *   dailyLimit: 100,
 *   excludePaths: ['/api/health'],
 * });
 * ```
 */
export function withRateLimit(config: RateLimitConfig = {}) {
  return async function middleware(request: NextRequest) {
    // Get environment (process.env on Edge Runtime)
    const env = process.env as any;

    // Check if RATE_LIMITER Durable Object binding exists
    if (!env.RATE_LIMITER) {
      console.warn(
        "[@ottabase/cf-ratelimiter] RATE_LIMITER binding not found. Rate limiting disabled."
      );
      return NextResponse.next();
    }

    try {
      // Convert NextRequest to standard Request
      const standardRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
      });

      // Check rate limit
      const result = await checkRateLimit(standardRequest, env, config);

      // If not allowed, return 429
      if (!result.allowed) {
        return createRateLimitResponse(result);
      }

      // Add rate limit headers to response
      const response = NextResponse.next();
      const headers = createRateLimitHeaders(result);

      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("[@ottabase/cf-ratelimiter] Error:", error);
      // On error, allow request through (fail open)
      return NextResponse.next();
    }
  };
}

/**
 * Helper to create a custom middleware with additional logic
 *
 * Usage:
 * ```typescript
 * export default createRateLimitMiddleware(
 *   { dailyLimit: 100 },
 *   async (request, rateLimitResult) => {
 *     // Custom logic here
 *     if (request.url.includes('/admin')) {
 *       return NextResponse.redirect('/login');
 *     }
 *     return NextResponse.next();
 *   }
 * );
 * ```
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = {},
  customHandler?: (
    request: NextRequest,
    rateLimitResult: any
  ) => Promise<NextResponse> | NextResponse
) {
  return async function middleware(request: NextRequest) {
    const env = process.env as any;

    if (!env.RATE_LIMITER) {
      console.warn(
        "[@ottabase/cf-ratelimiter] RATE_LIMITER binding not found. Rate limiting disabled."
      );
      if (customHandler) {
        return customHandler(request, null);
      }
      return NextResponse.next();
    }

    try {
      const standardRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
      });

      const result = await checkRateLimit(standardRequest, env, config);

      if (!result.allowed) {
        return createRateLimitResponse(result);
      }

      // Run custom handler if provided
      if (customHandler) {
        const response = await customHandler(request, result);
        const headers = createRateLimitHeaders(result);
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      const response = NextResponse.next();
      const headers = createRateLimitHeaders(result);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("[@ottabase/cf-ratelimiter] Error:", error);
      if (customHandler) {
        return customHandler(request, null);
      }
      return NextResponse.next();
    }
  };
}
