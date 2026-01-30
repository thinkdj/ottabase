/**
 * Hyperdrive wrapper
 * Type-safe wrapper for Cloudflare Hyperdrive database connection pooling
 *
 * @see https://developers.cloudflare.com/hyperdrive/
 */

import type { Hyperdrive } from '@cloudflare/workers-types';
import { CloudflareError, type Result } from './types';

export interface HyperdriveConfig {
    hyperdrive: Hyperdrive;
}

/**
 * Type-safe Hyperdrive wrapper
 * Provides connection pooling and caching for PostgreSQL and MySQL databases
 */
export class HyperdriveClient {
    private hyperdrive: Hyperdrive;

    constructor(config: HyperdriveConfig) {
        if (!config.hyperdrive) {
            throw new CloudflareError('Hyperdrive binding is required', 'HYPERDRIVE_MISSING_BINDING');
        }
        this.hyperdrive = config.hyperdrive;
    }

    /**
     * Get the connection string for connecting to the database through Hyperdrive
     */
    getConnectionString(): string {
        return this.hyperdrive.connectionString;
    }

    /**
     * Get the database host
     */
    getHost(): string {
        return this.hyperdrive.host;
    }

    /**
     * Get the database port
     */
    getPort(): number {
        return this.hyperdrive.port;
    }

    /**
     * Get the database name
     */
    getDatabase(): string {
        return this.hyperdrive.database;
    }

    /**
     * Get the database user
     */
    getUser(): string {
        return this.hyperdrive.user;
    }

    /**
     * Get the database password (use with caution)
     */
    getPassword(): string {
        return this.hyperdrive.password;
    }

    /**
     * Get raw Hyperdrive instance for advanced usage
     */
    getRaw(): Hyperdrive {
        return this.hyperdrive;
    }

    /**
     * Create a connection using a specific database driver
     * This is a helper method - use with your preferred DB client (pg, mysql2, etc.)
     */
    async connect<T>(connectionFactory: (connectionString: string) => Promise<T>): Promise<Result<T, Error>> {
        try {
            const connection = await connectionFactory(this.getConnectionString());

            return {
                success: true,
                data: connection,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
}

/**
 * Create a Hyperdrive client instance
 */
export function createHyperdriveClient(config: HyperdriveConfig): HyperdriveClient {
    return new HyperdriveClient(config);
}
