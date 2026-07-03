// ============================================================
// @ottabase/db - Drizzle D1 Driver
// ============================================================
//
// Cloudflare D1-specific Drizzle driver implementation
// This driver provides D1 database access through Drizzle ORM
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import type { SQL } from 'drizzle-orm';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { BaseDbDriver, raw, type DbDriverConfig, type DbRawResult } from './drizzle';

// Re-export raw query functionality
export { raw, type DbRawResult };

/**
 * D1-specific driver configuration
 */
export interface D1DriverConfig extends DbDriverConfig {
    /**
     * Custom schema (optional)
     */
    schema?: Record<string, unknown>;
}

/**
 * Cloudflare D1 database driver
 */
export class D1Driver extends BaseDbDriver {
    private d1Binding: D1Database;

    constructor(d1: D1Database, config: D1DriverConfig = {}) {
        const db = drizzleD1(d1, { schema: config.schema });
        super(db, config);
        this.d1Binding = d1;
    }

    async execute<T = unknown>(query: SQL): Promise<T[]> {
        this.log(`Executing query`, 'query');

        try {
            // Execute using Drizzle
            const result = await this.db.execute(query);
            return result as T[];
        } catch (error) {
            this.log(`Query error: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }

    /**
     * Get the underlying D1 binding
     */
    getD1(): D1Database {
        return this.d1Binding;
    }

    /**
     * Execute raw D1 SQL (bypassing Drizzle)
     */
    async executeRaw(sql: string, params?: unknown[]): Promise<any> {
        this.log(`Executing raw SQL: ${sql}`, 'query');

        try {
            const stmt = this.d1Binding.prepare(sql);
            if (params && params.length > 0) {
                return await stmt.bind(...params).all();
            }
            return await stmt.all();
        } catch (error) {
            this.log(`Raw query error: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }

    /**
     * Execute multiple SQL statements as a batch/transaction
     * Uses D1's native batch API for atomicity
     */
    async executeBatch(sqls: string[]): Promise<any> {
        this.log(`Executing batch of ${sqls.length} statements`, 'query');

        try {
            const statements = sqls.map((sql) => this.d1Binding.prepare(sql));
            return await this.d1Binding.batch(statements);
        } catch (error) {
            this.log(`Batch query error: ${error instanceof Error ? error.message : String(error)}`, 'error');
            throw error;
        }
    }
}

/**
 * Per-isolate cache of the default D1 driver, keyed by the D1 binding object.
 *
 * Cloudflare bindings are stable object references within an isolate, and a `D1Driver`
 * holds no per-request mutable state (just the Drizzle query builder bound to the D1
 * binding). Worker handlers call `createD1Driver(env.OBCF_D1)` once per request — often
 * several times across the request lifecycle — so without this cache every request rebuilds
 * a Drizzle instance for a binding that never changes. The WeakMap lets a reclaimed binding
 * be garbage-collected with its driver.
 */
const defaultDriverCache = new WeakMap<D1Database, D1Driver>();

/**
 * Create a D1 driver instance.
 *
 * Config-less calls (the overwhelmingly common case in request handlers) reuse a single
 * cached driver per binding within the isolate; a call that passes a custom config always
 * gets a fresh, uncached driver so bespoke logging/schema options are never shared.
 *
 * @example
 * ```typescript
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const driver = createD1Driver(env.OBCF_D1);
 *     // Use driver with models
 *     const users = await User.all(driver);
 *     return Response.json(users);
 *   }
 * }
 * ```
 */
export function createD1Driver(d1: D1Database, config: D1DriverConfig = {}): D1Driver {
    // A custom config must not be served from (or pollute) the shared default cache.
    if (config && Object.keys(config).length > 0) {
        return new D1Driver(d1, config);
    }

    const cached = defaultDriverCache.get(d1);
    if (cached) return cached;

    const driver = new D1Driver(d1);
    defaultDriverCache.set(d1, driver);
    return driver;
}

/**
 * Check if a value is a D1 database binding
 */
export function isD1Database(value: unknown): value is D1Database {
    return (
        typeof value === 'object' &&
        value !== null &&
        'prepare' in value &&
        'batch' in value &&
        'exec' in value &&
        typeof (value as D1Database).prepare === 'function' &&
        typeof (value as D1Database).batch === 'function' &&
        typeof (value as D1Database).exec === 'function'
    );
}
