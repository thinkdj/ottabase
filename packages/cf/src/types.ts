/**
 * Core types for Cloudflare bindings
 * Framework-agnostic TypeScript types for all Cloudflare services
 */

export type CloudflareEnv = Record<string, unknown>;

/**
 * Base result type for all operations
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Generic Cloudflare binding configuration
 */
export interface BindingConfig {
  name: string;
  binding?: unknown;
}

/**
 * Error types for better error handling
 */
export class CloudflareError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CloudflareError';
  }
}

/**
 * Common options for operations
 */
export interface OperationOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Whether to throw on error or return Result type
   */
  throwOnError?: boolean;
}
