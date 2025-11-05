/**
 * D1 Database wrapper
 * Type-safe wrapper for Cloudflare D1 SQLite database
 *
 * @see https://developers.cloudflare.com/d1/
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types';
import { CloudflareError, type Result } from './types';

export interface D1Config {
  database: D1Database;
}

export interface D1QueryOptions {
  /**
   * Whether to throw on error or return Result type
   */
  throwOnError?: boolean;
}

/**
 * Type-safe D1 database wrapper
 */
export class D1Client {
  private db: D1Database;

  constructor(config: D1Config) {
    if (!config.database) {
      throw new CloudflareError(
        'D1 database binding is required',
        'D1_MISSING_BINDING'
      );
    }
    this.db = config.database;
  }

  /**
   * Execute a single SQL query
   */
  async query<T = unknown>(
    sql: string,
    params?: unknown[],
    options?: D1QueryOptions
  ): Promise<Result<T[], Error>> {
    try {
      const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
      const result = await stmt.all<T>();

      if (!result.success) {
        throw new CloudflareError(
          result.error || 'Query failed',
          'D1_QUERY_ERROR'
        );
      }

      return {
        success: true,
        data: result.results || [],
      };
    } catch (error) {
      if (options?.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute a single query and return the first result
   */
  async queryFirst<T = unknown>(
    sql: string,
    params?: unknown[],
    options?: D1QueryOptions
  ): Promise<Result<T | null, Error>> {
    try {
      const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
      const result = await stmt.first<T>();

      return {
        success: true,
        data: result || null,
      };
    } catch (error) {
      if (options?.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute multiple queries in a batch
   */
  async batch<T = unknown>(
    queries: Array<{ sql: string; params?: unknown[] }>,
    options?: D1QueryOptions
  ): Promise<Result<D1Result<T>[], Error>> {
    try {
      const statements = queries.map(({ sql, params }) =>
        params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql)
      );

      const results = await this.db.batch<T>(statements);

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      if (options?.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  async execute(
    sql: string,
    params?: unknown[],
    options?: D1QueryOptions
  ): Promise<Result<D1Result, Error>> {
    try {
      const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
      const result = await stmt.run();

      if (!result.success) {
        throw new CloudflareError(
          result.error || 'Execute failed',
          'D1_EXECUTE_ERROR'
        );
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (options?.throwOnError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get raw D1Database instance for advanced usage
   */
  getRaw(): D1Database {
    return this.db;
  }
}

/**
 * Create a D1 client instance
 */
export function createD1Client(config: D1Config): D1Client {
  return new D1Client(config);
}
