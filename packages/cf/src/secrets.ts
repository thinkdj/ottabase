/**
 * Secrets Store wrapper
 * Type-safe wrapper for Cloudflare Secret Store (environment variables and secrets)
 *
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

import { CloudflareError, type Result } from './types';

export interface SecretsConfig {
    /**
     * Environment object containing secrets
     */
    env: Record<string, unknown>;
}

/**
 * Type-safe Secrets wrapper
 * Provides type-safe access to environment variables and secrets
 */
export class SecretsClient {
    private env: Record<string, unknown>;

    constructor(config: SecretsConfig) {
        if (!config.env) {
            throw new CloudflareError('Environment object is required', 'SECRETS_MISSING_ENV');
        }
        this.env = config.env;
    }

    /**
     * Get a secret value by key
     */
    get<T = string>(key: string): Result<T | undefined, Error> {
        try {
            const value = this.env[key] as T | undefined;

            return {
                success: true,
                data: value,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * Get a required secret value (throws if missing)
     */
    getRequired<T = string>(key: string): Result<T, Error> {
        try {
            const value = this.env[key] as T | undefined;

            if (value === undefined) {
                throw new CloudflareError(`Required secret '${key}' is missing`, 'SECRETS_MISSING_REQUIRED', { key });
            }

            return {
                success: true,
                data: value,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * Get a secret with a default value
     */
    getWithDefault<T = string>(key: string, defaultValue: T): T {
        const value = this.env[key] as T | undefined;
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Check if a secret exists
     */
    has(key: string): boolean {
        return key in this.env && this.env[key] !== undefined;
    }

    /**
     * Get all secret keys
     */
    keys(): string[] {
        return Object.keys(this.env);
    }

    /**
     * Get raw environment object for advanced usage
     */
    getRaw(): Record<string, unknown> {
        return this.env;
    }
}

/**
 * Create a Secrets client instance
 */
export function createSecretsClient(config: SecretsConfig): SecretsClient {
    return new SecretsClient(config);
}
