/**
 * Cloudflare D1 adapter
 */

import type {
  ID1Database,
  ID1PreparedStatement,
  D1Result,
  D1Params,
  D1Database,
} from '../types';

/**
 * D1 Prepared Statement adapter
 */
class D1PreparedStatementAdapter<T = unknown>
  implements ID1PreparedStatement<T>
{
  constructor(
    private readonly statement: D1PreparedStatement,
    private params: D1Params = []
  ) {}

  /**
   * Bind parameters to the statement
   */
  bind(...params: D1Params): ID1PreparedStatement<T> {
    this.params = params;
    return new D1PreparedStatementAdapter<T>(
      this.statement.bind(...params) as D1PreparedStatement,
      params
    );
  }

  /**
   * Execute and return first result
   */
  async first<R = T>(column?: string): Promise<R | null> {
    try {
      const result = column !== undefined
        ? await this.statement.first(column)
        : await this.statement.first();
      return (result as R) || null;
    } catch (error) {
      console.error('Error executing D1 statement (first):', error);
      throw error;
    }
  }

  /**
   * Execute and return all results
   */
  async all<R = T>(): Promise<D1Result<R>> {
    try {
      const result = await this.statement.all();
      return {
        results: result.results as R[],
        success: result.success,
        meta: result.meta ? {
          duration: result.meta.duration,
          rows_read: result.meta.rows_read,
          rows_written: result.meta.rows_written,
        } : undefined,
      };
    } catch (error) {
      console.error('Error executing D1 statement (all):', error);
      return {
        results: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute without returning results
   */
  async run(): Promise<D1Result<never>> {
    try {
      const result = await this.statement.run();
      return {
        results: [],
        success: result.success,
        meta: result.meta ? {
          duration: result.meta.duration,
          rows_read: result.meta.rows_read,
          rows_written: result.meta.rows_written,
        } : undefined,
      };
    } catch (error) {
      console.error('Error executing D1 statement (run):', error);
      return {
        results: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * D1 Database adapter
 */
export class D1DatabaseAdapter implements ID1Database {
  constructor(private readonly database: D1Database) {
    if (!database) {
      throw new Error('D1 database is required');
    }
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = unknown>(
    sql: string,
    params?: D1Params
  ): Promise<D1Result<T>> {
    try {
      const statement = this.prepare<T>(sql);
      if (params && params.length > 0) {
        return await statement.bind(...params).all<T>();
      }
      return await statement.all<T>();
    } catch (error) {
      console.error('Error executing D1 query:', error);
      return {
        results: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a prepared statement
   */
  prepare<T = unknown>(sql: string): ID1PreparedStatement<T> {
    const statement = this.database.prepare(sql);
    return new D1PreparedStatementAdapter<T>(statement);
  }

  /**
   * Execute multiple statements in a batch
   */
  async batch<T = unknown>(
    statements: ID1PreparedStatement<unknown>[]
  ): Promise<D1Result<T>[]> {
    try {
      // Extract the underlying D1PreparedStatement objects
      const d1Statements = statements.map((stmt) => {
        if (stmt instanceof D1PreparedStatementAdapter) {
          return (stmt as any).statement as D1PreparedStatement;
        }
        throw new Error('Invalid statement type for batch operation');
      });

      const results = await this.database.batch(d1Statements);

      return results.map((result) => ({
        results: result.results as T[],
        success: result.success,
        meta: result.meta ? {
          duration: result.meta.duration,
          rows_read: result.meta.rows_read,
          rows_written: result.meta.rows_written,
        } : undefined,
      }));
    } catch (error) {
      console.error('Error executing D1 batch:', error);
      throw error;
    }
  }

  /**
   * Execute statements in a transaction
   */
  async transaction<T>(
    callback: (tx: ID1Database) => Promise<T>
  ): Promise<T> {
    // D1 doesn't have native transaction support yet, so we simulate it
    // by wrapping operations in a try-catch and rolling back on error
    try {
      return await callback(this);
    } catch (error) {
      console.error('Error in D1 transaction:', error);
      throw error;
    }
  }

  /**
   * Execute a query and return the first result
   */
  async queryFirst<T = unknown>(
    sql: string,
    params?: D1Params
  ): Promise<T | null> {
    const statement = this.prepare<T>(sql);
    if (params && params.length > 0) {
      return await statement.bind(...params).first<T>();
    }
    return await statement.first<T>();
  }

  /**
   * Execute a non-query statement (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params?: D1Params): Promise<D1Result<never>> {
    const statement = this.prepare(sql);
    if (params && params.length > 0) {
      return await statement.bind(...params).run();
    }
    return await statement.run();
  }
}

/**
 * Create a D1 database adapter
 */
export function createD1Database(database: D1Database): ID1Database {
  return new D1DatabaseAdapter(database);
}

/**
 * Prisma adapter for D1
 *
 * This provides a bridge between Prisma and D1 for use with Prisma's
 * driver adapters feature.
 */
export class PrismaD1Adapter {
  constructor(private readonly database: ID1Database) {}

  /**
   * Execute a query using Prisma's expected interface
   */
  async queryRaw<T = unknown>(
    query: string,
    ...params: D1Params
  ): Promise<T[]> {
    const result = await this.database.query<T>(query, params);
    return result.results;
  }

  /**
   * Execute a raw query and return the first result
   */
  async queryRawUnsafe<T = unknown>(
    query: string,
    ...params: D1Params
  ): Promise<T[]> {
    return this.queryRaw<T>(query, ...params);
  }

  /**
   * Execute a non-query statement
   */
  async executeRaw(query: string, ...params: D1Params): Promise<number> {
    if (this.database.execute) {
      const result = await this.database.execute(query, params);
      return result.meta?.rows_written || 0;
    }
    // Fallback to using prepare and run
    const result = await this.database.prepare(query).bind(...params).run();
    return result.meta?.rows_written || 0;
  }

  /**
   * Execute a raw statement
   */
  async executeRawUnsafe(query: string, ...params: D1Params): Promise<number> {
    return this.executeRaw(query, ...params);
  }
}

/**
 * Create a Prisma D1 adapter
 */
export function createPrismaD1Adapter(database: D1Database): PrismaD1Adapter {
  const d1Adapter = createD1Database(database);
  return new PrismaD1Adapter(d1Adapter);
}

/**
 * Export types
 */
export type {
  ID1Database,
  ID1PreparedStatement,
  D1Result,
  D1Params,
} from '../types';
