/**
 * Core types for Cloudflare bindings
 * Framework-agnostic TypeScript types for all Cloudflare services
 */

export type CloudflareEnv = Record<string, unknown>;

/**
 * Base result type for all operations
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/** Run `work` and fold its outcome into a `Result`; a thrown non-Error becomes an Error. */
export async function attempt<T>(work: () => Promise<T>): Promise<Result<T, Error>> {
    try {
        return { success: true, data: await work() };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
}

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
        public readonly details?: unknown,
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
