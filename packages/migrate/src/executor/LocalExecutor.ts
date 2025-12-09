import Database from 'better-sqlite3';
import type { MigrationDatabase } from '../core/StateManager';

/**
 * Executor for local SQLite databases using better-sqlite3
 */
export class LocalExecutor implements MigrationDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Execute a single SQL statement with parameters
   */
  async run(sql: string, params?: any[]): Promise<void> {
    const stmt = this.db.prepare(sql);
    stmt.run(...(params || []));
  }

  /**
   * Execute multiple SQL statements (batch)
   */
  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * Execute a query and return all results
   */
  async all(sql: string, params?: any[]): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params || []));
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the underlying better-sqlite3 database instance
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}

/**
 * Factory function to create local executor
 */
export function createLocalExecutor(dbPath: string): LocalExecutor {
  return new LocalExecutor(dbPath);
}
