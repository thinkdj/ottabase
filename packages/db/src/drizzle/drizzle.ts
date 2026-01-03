// ============================================================
// @ottabase/db - Drizzle Driver Base
// ============================================================
//
// Base driver interface and types for Drizzle ORM integration
// This provides an abstraction layer over Drizzle
// ============================================================

import type { SQL } from "drizzle-orm";

/**
 * Database driver interface
 * Provides a unified interface for database operations
 */
export interface DbDriver {
  /**
   * Execute a raw SQL query using Drizzle SQL object
   */
  execute<T = unknown>(query: SQL): Promise<T[]>;

  /**
   * Execute raw SQL string (for DDL, PRAGMA, etc.)
   */
  executeRaw?(sql: string, params?: unknown[]): Promise<any>;

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
  log?: boolean | ("query" | "info" | "warn" | "error")[];
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

  getDb(): any {
    return this.db;
  }

  async close(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Log a query if logging is enabled
   */
  protected log(message: string, level: "query" | "info" | "warn" | "error" = "info"): void {
    const { log } = this.config;

    if (log === true || (Array.isArray(log) && log.includes(level))) {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }
}
