// ============================================================
// OttaORM - Runtime Migration Generator
// ============================================================
//
// This module provides runtime migration generation that works
// directly in API routes without requiring Drizzle Kit CLI.
//
// It uses Drizzle's built-in schema introspection and diff logic
// to automatically detect and apply schema changes.
// ============================================================

import { type DbDriver } from '@ottabase/db';
import { sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

export interface RuntimeMigrationConfig {
  /**
   * Database driver
   */
  driver: DbDriver;

  /**
   * All table schemas (from Models)
   */
  tables: Record<string, SQLiteTable>;

  /**
   * Include custom SQL migrations
   */
  customMigrations?: Array<{
    name: string;
    up: (db: DbDriver) => Promise<void>;
    down?: (db: DbDriver) => Promise<void>;
  }>;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

/**
 * Generate CREATE TABLE SQL from Drizzle table definition
 */
function generateCreateTableSQL(table: SQLiteTable): string {
  const config = getTableConfig(table);
  const tableName = config.name;
  const columns = config.columns;

  const columnDefs = columns.map(col => {
    let def = `${col.name} ${col.getSQLType()}`;

    // Primary key
    if (col.primary) {
      def += ' PRIMARY KEY';
    }

    // Not null
    if (col.notNull) {
      def += ' NOT NULL';
    }

    // Unique
    if (col.isUnique) {
      def += ' UNIQUE';
    }

    // Default value (simplified - Drizzle handles this via $defaultFn)
    if (col.default !== undefined && col.default !== null) {
      if (typeof col.default === 'string') {
        def += ` DEFAULT '${col.default}'`;
      } else if (typeof col.default === 'number') {
        def += ` DEFAULT ${col.default}`;
      } else if (typeof col.default === 'boolean') {
        def += ` DEFAULT ${col.default ? 1 : 0}`;
      }
    }

    return def;
  });

  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnDefs.join(',\n  ')}\n)`;
}

/**
 * Get list of existing tables in the database
 */
async function getExistingTables(driver: DbDriver): Promise<Set<string>> {
  try {
    const result = await driver.executeRaw(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_ottabase_%'
    `);

    const tables = new Set<string>();
    if (result.results && Array.isArray(result.results)) {
      for (const row of result.results) {
        if (row.name) {
          tables.add(row.name as string);
        }
      }
    }

    return tables;
  } catch (error) {
    console.error('Error fetching existing tables:', error);
    return new Set();
  }
}

/**
 * Get column information for an existing table
 */
async function getTableColumns(driver: DbDriver, tableName: string): Promise<Set<string>> {
  try {
    const result = await driver.executeRaw(`PRAGMA table_info(${tableName})`);

    const columns = new Set<string>();
    if (result.results && Array.isArray(result.results)) {
      for (const row of result.results) {
        if (row.name) {
          columns.add(row.name as string);
        }
      }
    }

    return columns;
  } catch (error) {
    console.error(`Error fetching columns for table ${tableName}:`, error);
    return new Set();
  }
}

/**
 * Generate ALTER TABLE SQL for new columns
 */
function generateAddColumnSQL(tableName: string, table: SQLiteTable, existingColumns: Set<string>): string[] {
  const config = getTableConfig(table);
  const columns = config.columns;
  const alterStatements: string[] = [];

  for (const col of columns) {
    if (!existingColumns.has(col.name)) {
      let def = `${col.name} ${col.getSQLType()}`;

      // Note: SQLite has limitations on ALTER TABLE
      // We can't add NOT NULL columns without a DEFAULT value
      if (!col.notNull || col.default !== undefined) {
        if (col.default !== undefined && col.default !== null) {
          if (typeof col.default === 'string') {
            def += ` DEFAULT '${col.default}'`;
          } else if (typeof col.default === 'number') {
            def += ` DEFAULT ${col.default}`;
          } else if (typeof col.default === 'boolean') {
            def += ` DEFAULT ${col.default ? 1 : 0}`;
          }
        }

        if (col.notNull) {
          def += ' NOT NULL';
        }

        alterStatements.push(`ALTER TABLE ${tableName} ADD COLUMN ${def}`);
      } else {
        console.warn(`⚠️  Cannot add NOT NULL column '${col.name}' to existing table '${tableName}' without DEFAULT value`);
        console.warn(`   Add a DEFAULT value to the column definition or handle the migration manually`);
      }
    }
  }

  return alterStatements;
}

/**
 * Apply schema changes automatically (like drizzle-kit push)
 */
export async function autoMigrate(config: RuntimeMigrationConfig): Promise<{
  tablesCreated: string[];
  columnsAdded: string[];
  customMigrationsRun: string[];
  errors: string[];
}> {
  const { driver, tables, customMigrations = [], verbose = false } = config;

  const result = {
    tablesCreated: [] as string[],
    columnsAdded: [] as string[],
    customMigrationsRun: [] as string[],
    errors: [] as string[],
  };

  try {
    // Get existing tables
    const existingTables = await getExistingTables(driver);

    if (verbose) {
      console.log('📊 Existing tables:', Array.from(existingTables));
    }

    // Process each table from Models
    for (const [key, table] of Object.entries(tables)) {
      const config = getTableConfig(table);
      const tableName = config.name;

      if (!existingTables.has(tableName)) {
        // Create new table
        const createSQL = generateCreateTableSQL(table);

        if (verbose) {
          console.log(`\n🆕 Creating table: ${tableName}`);
          console.log(createSQL);
        }

        try {
          await driver.executeRaw(createSQL);
          result.tablesCreated.push(tableName);
        } catch (error: any) {
          const errorMsg = `Failed to create table ${tableName}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      } else {
        // Check for new columns
        const existingColumns = await getTableColumns(driver, tableName);
        const alterStatements = generateAddColumnSQL(tableName, table, existingColumns);

        for (const alterSQL of alterStatements) {
          if (verbose) {
            console.log(`\n➕ Adding column to ${tableName}`);
            console.log(alterSQL);
          }

          try {
            await driver.executeRaw(alterSQL);
            result.columnsAdded.push(`${tableName}.${alterSQL.match(/ADD COLUMN (\w+)/)?.[1]}`);
          } catch (error: any) {
            const errorMsg = `Failed to alter table ${tableName}: ${error.message}`;
            result.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        }
      }
    }

    // Run custom migrations
    if (customMigrations.length > 0) {
      // Ensure migration tracking table exists
      await driver.executeRaw(`
        CREATE TABLE IF NOT EXISTS _ottabase_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          executed_at INTEGER NOT NULL,
          driver_type TEXT DEFAULT 'd1-drizzle'
        )
      `);

      for (const migration of customMigrations) {
        // Check if already executed
        const existingResult = await driver.executeRaw(
          `SELECT name FROM _ottabase_migrations WHERE name = ?`,
          [migration.name]
        );

        const alreadyRun = existingResult.results && existingResult.results.length > 0;

        if (!alreadyRun) {
          if (verbose) {
            console.log(`\n🔧 Running custom migration: ${migration.name}`);
          }

          try {
            await migration.up(driver);

            // Record execution
            await driver.executeRaw(
              `INSERT INTO _ottabase_migrations (name, executed_at) VALUES (?, ?)`,
              [migration.name, Date.now()]
            );

            result.customMigrationsRun.push(migration.name);
          } catch (error: any) {
            const errorMsg = `Failed to run migration ${migration.name}: ${error.message}`;
            result.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        } else if (verbose) {
          console.log(`⏭️  Skipping already executed migration: ${migration.name}`);
        }
      }
    }
  } catch (error: any) {
    const errorMsg = `Auto-migration failed: ${error.message}`;
    result.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }

  return result;
}

/**
 * Simplified auto-migrate that returns a summary
 */
export async function runAutoMigrations(
  driver: DbDriver,
  tables: Record<string, SQLiteTable>,
  customMigrations?: Array<{ name: string; up: (db: DbDriver) => Promise<void> }>
): Promise<{
  success: boolean;
  message: string;
  details: {
    tablesCreated: string[];
    columnsAdded: string[];
    customMigrationsRun: string[];
    errors: string[];
  };
}> {
  const result = await autoMigrate({
    driver,
    tables,
    customMigrations,
    verbose: true,
  });

  const { tablesCreated, columnsAdded, customMigrationsRun, errors } = result;

  const totalChanges = tablesCreated.length + columnsAdded.length + customMigrationsRun.length;

  return {
    success: errors.length === 0,
    message: errors.length > 0
      ? `Migrations completed with ${errors.length} error(s)`
      : totalChanges > 0
      ? `Successfully applied ${totalChanges} change(s)`
      : 'No changes detected - database is up to date',
    details: result,
  };
}
