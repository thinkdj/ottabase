/**
 * Rate Limiting wrapper
 * Type-safe wrapper for Cloudflare Rate Limiting
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */

import type { RateLimiter } from '@cloudflare/workers-types';
import { CloudflareError, type Result } from './types';

export interface RateLimitingConfig {
  rateLimiter: RateLimiter;
}

export interface RateLimitOptions {
  /**
   * Unique key for this rate limit check (e.g., user ID, IP address)
   */
  key: string;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  success: boolean;

  /**
   * Current limit value
   */
  limit: number;

  /**
   * Remaining requests in the current window
   */
  remaining: number;

  /**
   * Time until the rate limit resets (in seconds)
   */
  resetAfter: number;
}

/**
 * Type-safe Rate Limiting wrapper
 */
export class RateLimitingClient {
  private rateLimiter: RateLimiter;

  constructor(config: RateLimitingConfig) {
    if (!config.rateLimiter) {
      throw new CloudflareError(
        'RateLimiter binding is required',
        'RATE_LIMITING_MISSING_BINDING'
      );
    }
    this.rateLimiter = config.rateLimiter;
  }

  /**
   * Check if a request should be rate limited
   */
  async limit(options: RateLimitOptions): Promise<Result<RateLimitResult, Error>> {
    try {
      const result = await this.rateLimiter.limit({ key: options.key });

      return {
        success: true,
        data: {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          resetAfter: result.resetAfter,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Check rate limit and throw if exceeded
   */
  async check(options: RateLimitOptions): Promise<Result<void, Error>> {
    const result = await this.limit(options);

    if (!result.success) {
      return result;
    }

    if (!result.data.success) {
      return {
        success: false,
        error: new CloudflareError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          {
            limit: result.data.limit,
            remaining: result.data.remaining,
            resetAfter: result.data.resetAfter,
          }
        ),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  }

  /**
   * Get raw RateLimiter instance for advanced usage
   */
  getRaw(): RateLimiter {
    return this.rateLimiter;
  }
}

/**
 * Create a Rate Limiting client instance
 */
export function createRateLimitingClient(config: RateLimitingConfig): RateLimitingClient {
  return new RateLimitingClient(config);
}
