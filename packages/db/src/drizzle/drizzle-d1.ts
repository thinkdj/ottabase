// ============================================================
// @ottabase/db - Drizzle D1 Driver
// ============================================================
//
// Cloudflare D1-specific Drizzle driver implementation
// This driver provides D1 database access through Drizzle ORM
// ============================================================

import type { D1Database } from "@cloudflare/workers-types";
import type { SQL } from "drizzle-orm";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import {
  BaseDbDriver,
  raw,
  type DbDriverConfig,
  type DbRawResult,
} from "./drizzle";

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
    this.log(`Executing query`, "query");

    try {
      // Execute using Drizzle
      const result = await this.db.execute(query);
      return result as T[];
    } catch (error) {
      this.log(`Query error: ${error instanceof Error ? error.message : String(error)}`, "error");
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
    this.log(`Executing raw SQL: ${sql}`, "query");

    try {
      const stmt = this.d1Binding.prepare(sql);
      if (params && params.length > 0) {
        return await stmt.bind(...params).all();
      }
      return await stmt.all();
    } catch (error) {
      this.log(`Raw query error: ${error instanceof Error ? error.message : String(error)}`, "error");
      throw error;
    }
  }
}

/**
 * Create a D1 driver instance
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
  return new D1Driver(d1, config);
}

/**
 * Check if a value is a D1 database binding
 */
export function isD1Database(value: unknown): value is D1Database {
  return (
    typeof value === "object" &&
    value !== null &&
    "prepare" in value &&
    "batch" in value &&
    "exec" in value &&
    typeof (value as D1Database).prepare === "function" &&
    typeof (value as D1Database).batch === "function" &&
    typeof (value as D1Database).exec === "function"
  );
}
