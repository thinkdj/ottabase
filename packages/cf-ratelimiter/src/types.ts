/**
 * Rate limiter configuration options
 */
export interface RateLimitConfig {
  /**
   * Daily request limit per IP (default: 100)
   */
  dailyLimit?: number;

  /**
   * Whether to bypass rate limiting for authenticated users (default: false)
   */
  bypassAuthenticated?: boolean;

  /**
   * Custom header to check for authentication (default: 'authorization')
   */
  authHeader?: string;

  /**
   * Paths to exclude from rate limiting (exact match or prefix)
   */
  excludePaths?: string[];

  /**
   * Paths to include for rate limiting (if specified, only these paths are limited)
   */
  includePaths?: string[];
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Current request count for the period
   */
  count: number;

  /**
   * Maximum allowed requests for the period
   */
  limit: number;

  /**
   * Remaining requests in the period
   */
  remaining: number;

  /**
   * Unix timestamp when the limit resets (milliseconds)
   */
  resetAt: number;
}

/**
 * Durable Object state storage interface
 */
export interface RateLimitState {
  count: number;
  resetAt: number;
}
