// ============================================================
// @ottabase/db - Drizzle Driver Base
// ============================================================
//
// Base driver interface and types for Drizzle ORM integration
// This provides an abstraction layer over Drizzle
// ============================================================

import type { SQL } from 'drizzle-orm';

/**
 * Database driver interface
 * Provides a unified interface for database operations
 */
export interface DbDriver {
    /**
     * Execute a Drizzle SQL query
     */
    execute<T = unknown>(query: SQL): Promise<T[]>;

    /**
     * Execute raw SQL string (for migrations and DDL)
     */
    executeRaw(sql: string, params?: unknown[]): Promise<any>;

    /**
     * Get the underlying Drizzle database instance
     */
    getDb(): any;

    /**
     * Close the database connection (if applicable)
     */
    close?(): Promise<void>;
}

/**
 * Configuration for creating a database driver
 */
export interface DbDriverConfig {
    /**
     * Enable query logging
     */
    log?: boolean | ('query' | 'info' | 'warn' | 'error')[];
}

/**
 * Base database driver implementation
 * Can be extended for specific database implementations
 */
export abstract class BaseDbDriver implements DbDriver {
    protected db: any;
    protected config: DbDriverConfig;

    constructor(db: any, config: DbDriverConfig = {}) {
        this.db = db;
        this.config = config;
    }

    abstract execute<T = unknown>(query: SQL): Promise<T[]>;

    abstract executeRaw(sql: string, params?: unknown[]): Promise<any>;

    getDb(): any {
        return this.db;
    }

    async close(): Promise<void> {
        // Override in subclasses if needed
    }

    /**
     * Log a query if logging is enabled
     */
    protected log(message: string, level: 'query' | 'info' | 'warn' | 'error' = 'info'): void {
        const { log } = this.config;

        if (log === true || (Array.isArray(log) && log.includes(level))) {
            console.log(`[${level.toUpperCase()}] ${message}`);
        }
    }
}

/**
 * Result from a raw SQL query
 */
export interface DbRawResult<T = unknown> {
    results: T[];
    success: boolean;
    meta?: {
        changes?: number;
        duration?: number;
        last_row_id?: number;
    };
}

/**
 * Execute a raw SQL query using the driver
 *
 * @param driver - Database driver instance
 * @param sql - SQL query string
 * @param params - Optional query parameters
 * @returns Query results
 *
 * @example
 * ```typescript
 * import { raw } from "@ottabase/db/drizzle";
 *
 * const driver = createD1Driver(env.OBCF_D1);
 * const result = await raw(driver, "SELECT * FROM users WHERE id = ?", [userId]);
 * console.log(result.results);
 * ```
 */
export async function raw<T = unknown>(driver: DbDriver, sql: string, params?: unknown[]): Promise<DbRawResult<T>> {
    const result = await driver.executeRaw(sql, params);

    // Normalize D1 response format
    if (result && typeof result === 'object' && 'results' in result) {
        return {
            results: result.results as T[],
            success: result.success ?? true,
            meta: result.meta,
        };
    }

    // Handle array response
    if (Array.isArray(result)) {
        return {
            results: result as T[],
            success: true,
        };
    }

    return {
        results: [],
        success: true,
        meta: result,
    };
}
