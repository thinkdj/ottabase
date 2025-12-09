import type { MigrateConfig } from '../config/types';

export interface MigrationRecord {
  id?: number;
  name: string;
  feature: string;
  checksum: string;
  executedAt: number;
  executionTime?: number;
  status: 'applied' | 'failed' | 'rolled_back';
}

export interface MigrationDatabase {
  run(sql: string, params?: any[]): Promise<void>;
  exec(sql: string): Promise<void>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

/**
 * Manages migration state in the database
 */
export class StateManager {
  constructor(
    private db: MigrationDatabase,
    private config: MigrateConfig
  ) {}

  /**
   * Ensure the migration state tables exist
   */
  async ensureTables(): Promise<void> {
    // Create migrations tracking table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.stateTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        feature TEXT NOT NULL,
        checksum TEXT NOT NULL,
        executed_at INTEGER NOT NULL,
        execution_time INTEGER,
        status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied', 'failed', 'rolled_back'))
      )
    `);

    // Create indexes for better query performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_migrations_feature ON ${this.config.stateTable}(feature)
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_migrations_status ON ${this.config.stateTable}(status)
    `);
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.all(
      `SELECT * FROM ${this.config.stateTable}
       WHERE status = 'applied'
       ORDER BY executed_at ASC`
    );

    return result.map(this.mapRowToRecord);
  }

  /**
   * Get all migrations (applied, failed, rolled back)
   */
  async getAllMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.all(
      `SELECT * FROM ${this.config.stateTable}
       ORDER BY executed_at DESC`
    );

    return result.map(this.mapRowToRecord);
  }

  /**
   * Get migrations by feature
   */
  async getMigrationsByFeature(feature: string): Promise<MigrationRecord[]> {
    const result = await this.db.all(
      `SELECT * FROM ${this.config.stateTable}
       WHERE feature = ?
       ORDER BY executed_at ASC`,
      [feature]
    );

    return result.map(this.mapRowToRecord);
  }

  /**
   * Check if a migration has been applied
   */
  async isMigrationApplied(name: string): Promise<boolean> {
    const result = await this.db.all(
      `SELECT COUNT(*) as count FROM ${this.config.stateTable}
       WHERE name = ? AND status = 'applied'`,
      [name]
    );

    return result[0]?.count > 0;
  }

  /**
   * Get a specific migration record
   */
  async getMigration(name: string): Promise<MigrationRecord | null> {
    const result = await this.db.all(
      `SELECT * FROM ${this.config.stateTable}
       WHERE name = ?
       LIMIT 1`,
      [name]
    );

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToRecord(result[0]);
  }

  /**
   * Record a successfully applied migration
   */
  async recordMigration(migration: Omit<MigrationRecord, 'id'>): Promise<void> {
    await this.db.run(
      `INSERT INTO ${this.config.stateTable}
       (name, feature, checksum, executed_at, execution_time, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        migration.name,
        migration.feature,
        migration.checksum,
        migration.executedAt,
        migration.executionTime || null,
        migration.status,
      ]
    );
  }

  /**
   * Mark a migration as rolled back
   */
  async markRolledBack(name: string): Promise<void> {
    await this.db.run(
      `UPDATE ${this.config.stateTable}
       SET status = 'rolled_back'
       WHERE name = ?`,
      [name]
    );
  }

  /**
   * Mark a migration as failed
   */
  async markFailed(name: string): Promise<void> {
    await this.db.run(
      `UPDATE ${this.config.stateTable}
       SET status = 'failed'
       WHERE name = ?`,
      [name]
    );
  }

  /**
   * Delete a migration record (use with caution)
   */
  async deleteMigration(name: string): Promise<void> {
    await this.db.run(
      `DELETE FROM ${this.config.stateTable}
       WHERE name = ?`,
      [name]
    );
  }

  /**
   * Get the last applied migration
   */
  async getLastAppliedMigration(): Promise<MigrationRecord | null> {
    const result = await this.db.all(
      `SELECT * FROM ${this.config.stateTable}
       WHERE status = 'applied'
       ORDER BY executed_at DESC
       LIMIT 1`
    );

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToRecord(result[0]);
  }

  /**
   * Get migration statistics
   */
  async getStats(): Promise<{
    total: number;
    applied: number;
    failed: number;
    rolledBack: number;
  }> {
    const result = await this.db.all(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'rolled_back' THEN 1 ELSE 0 END) as rolledBack
       FROM ${this.config.stateTable}`
    );

    const row = result[0] || { total: 0, applied: 0, failed: 0, rolledBack: 0 };

    return {
      total: row.total || 0,
      applied: row.applied || 0,
      failed: row.failed || 0,
      rolledBack: row.rolledBack || 0,
    };
  }

  /**
   * Map database row to MigrationRecord
   */
  private mapRowToRecord(row: any): MigrationRecord {
    return {
      id: row.id,
      name: row.name,
      feature: row.feature,
      checksum: row.checksum,
      executedAt: row.executed_at,
      executionTime: row.execution_time,
      status: row.status,
    };
  }
}
