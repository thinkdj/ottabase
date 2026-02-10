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

import { type DbDriver } from '@ottabase/db/drizzle';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

/**
 * Migration tracking table name constant
 */
const MIGRATION_TABLE_NAME = '_ottabase_migrations';

/**
 * Escape single quotes in string values for SQL
 */
function escapeSQLString(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Quote SQLite identifier (table name, column name, etc.)
 */
function quoteIdentifier(identifier: string): string {
    if (typeof identifier !== 'string') {
        throw new TypeError('quoteIdentifier: identifier must be a string');
    }
    return `"${identifier.replace(/"/g, '""')}"`;
}

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
    /**
     * Whether destructive operations (drops/renames) are allowed.
     * Default: false
     */
    allowDestructive?: boolean;

    /**
     * Optional rename mapping for tables. Example:
     * { posts: { old_col_name: 'new_col_name' } }
     */
    renameMap?: Record<string, Record<string, string>>;
}

/**
 * Generate CREATE TABLE SQL from Drizzle table definition
 */
function generateCreateTableSQL(table: SQLiteTable, overrideName?: string): string {
    const config = getTableConfig(table);
    const tableName = overrideName ?? config.name;
    const columns = config.columns;

    const columnDefs = columns.map((col) => {
        let def = `${quoteIdentifier(col.name)} ${col.getSQLType()}`;

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
                const escapedDefault = escapeSQLString(col.default);
                def += ` DEFAULT '${escapedDefault}'`;
            } else if (typeof col.default === 'number') {
                def += ` DEFAULT ${col.default}`;
            } else if (typeof col.default === 'boolean') {
                def += ` DEFAULT ${col.default ? 1 : 0}`;
            }
        }

        return def;
    });

    return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (\n  ${columnDefs.join(',\n  ')}\n)`;
}

/**
 * Get list of existing tables in the database
 */
async function getExistingTables(driver: DbDriver): Promise<Set<string>> {
    try {
        if (!driver.executeRaw) {
            throw new Error('Driver does not support executeRaw - required for automated migrations');
        }
        // Query system tables to get list of user tables
        // Exclude system tables (sqlite_*) and migration tracking tables (_ottabase_*)
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
        const quotedTableName = quoteIdentifier(tableName);
        const result = await driver.executeRaw(`PRAGMA table_info(${quotedTableName})`);

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
            let def = `${quoteIdentifier(col.name)} ${col.getSQLType()}`;

            // Note: SQLite has limitations on ALTER TABLE
            // We can't add NOT NULL columns without a DEFAULT value
            if (!col.notNull || col.default !== undefined) {
                if (col.default !== undefined && col.default !== null) {
                    if (typeof col.default === 'string') {
                        const escapedDefault = escapeSQLString(col.default);
                        def += ` DEFAULT '${escapedDefault}'`;
                    } else if (typeof col.default === 'number') {
                        def += ` DEFAULT ${col.default}`;
                    } else if (typeof col.default === 'boolean') {
                        def += ` DEFAULT ${col.default ? 1 : 0}`;
                    }
                }

                if (col.notNull) {
                    def += ' NOT NULL';
                }

                alterStatements.push(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${def}`);
            } else {
                console.warn(
                    `⚠️  Cannot add NOT NULL column '${col.name}' to existing table '${tableName}' without DEFAULT value`,
                );
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
    customMigrationsSkipped: string[];
    tablesSkipped: string[];
    errors: string[];
}> {
    const { driver, tables, customMigrations = [], verbose = false, allowDestructive = false, renameMap = {} } = config;

    const result = {
        tablesCreated: [] as string[],
        columnsAdded: [] as string[],
        customMigrationsRun: [] as string[],
        customMigrationsSkipped: [] as string[],
        tablesSkipped: [] as string[],
        errors: [] as string[],
    };

    try {
        // Get existing tables
        const existingTables = await getExistingTables(driver);

        if (verbose) {
            console.log('📊 Existing tables:', Array.from(existingTables));
        }

        // Process each table from Models
        for (const table of Object.values(tables)) {
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
                // Track as skipped (already exists)
                result.tablesSkipped.push(tableName);

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
                        // Extract column name from ALTER TABLE ... ADD COLUMN statement
                        const columnMatch = alterSQL.match(
                            /ADD\s+COLUMN\s+("(?:""|[^"])*"|`(?:``|[^`])*`|\[(?:\]\]|[^\]])*\]|\S+)/i,
                        );
                        const rawColumnName = columnMatch?.[1];
                        let cleanedColumnName = 'unknown_column';

                        if (rawColumnName) {
                            // Remove quotes/brackets and unescape internal doubled characters
                            if (rawColumnName.startsWith('"') && rawColumnName.endsWith('"')) {
                                // Double-quoted identifier: "" inside becomes "
                                cleanedColumnName = rawColumnName.slice(1, -1).replace(/""/g, '"');
                            } else if (rawColumnName.startsWith('`') && rawColumnName.endsWith('`')) {
                                // Backtick-quoted identifier: `` inside becomes `
                                cleanedColumnName = rawColumnName.slice(1, -1).replace(/``/g, '`');
                            } else if (rawColumnName.startsWith('[') && rawColumnName.endsWith(']')) {
                                // Bracket-quoted identifier: ]] inside becomes ]
                                cleanedColumnName = rawColumnName.slice(1, -1).replace(/]]/g, ']');
                            } else {
                                cleanedColumnName = rawColumnName;
                            }
                        }
                        result.columnsAdded.push(`${tableName}.${cleanedColumnName}`);
                    } catch (error: any) {
                        const errorMsg = `Failed to alter table ${tableName}: ${error.message}`;
                        result.errors.push(errorMsg);
                        console.error(`❌ ${errorMsg}`);
                    }
                }
                // Check for removed columns (columns present in DB but not in model)
                const desiredColumns = new Set(getTableConfig(table).columns.map((c) => c.name));
                const removedColumns = Array.from(existingColumns).filter((c) => !desiredColumns.has(c));

                if (removedColumns.length > 0) {
                    if (!allowDestructive) {
                        const msg = `⚠️  Detected removed columns on ${tableName}: ${removedColumns.join(', ')} (skipped - destructive ops disabled)`;
                        console.warn(msg);
                        result.errors.push(msg);
                    } else {
                        if (verbose) {
                            console.log(
                                `\n🗑️  Destructive changes detected for ${tableName}: ${removedColumns.join(', ')}`,
                            );
                        }

                        // Recreate table strategy: create a new table, copy intersecting columns (respecting renameMap), drop old, rename new
                        const tableRenameMap = renameMap[tableName] || {};

                        const recreateSQLs: string[] = [];

                        // 0) DROP any pre-existing __new table from a previous failed run
                        const newTableName = `${tableName}__new`;
                        recreateSQLs.push(`DROP TABLE IF EXISTS ${quoteIdentifier(newTableName)}`);

                        // 1) CREATE new table with desired schema
                        const createSQL = generateCreateTableSQL(table, newTableName);
                        recreateSQLs.push(createSQL);

                        // 2) INSERT INTO new (...) SELECT ... FROM old
                        // Only insert columns that can be mapped from the existing table (including renames).
                        // New columns without a source are omitted so that SQLite applies column defaults.
                        const config = getTableConfig(table);

                        const insertCols: string[] = [];
                        const selectExprs: string[] = [];

                        for (const col of config.columns) {
                            const colName = col.name;

                            // If old column was renamed to new name
                            const mappedOld = Object.keys(tableRenameMap).find(
                                (old) => tableRenameMap[old] === colName,
                            );
                            if (mappedOld && existingColumns.has(mappedOld)) {
                                insertCols.push(colName);
                                selectExprs.push(`${quoteIdentifier(mappedOld)} AS ${quoteIdentifier(colName)}`);
                                continue;
                            }

                            // If column exists with the same name in the old table, copy it directly
                            if (existingColumns.has(colName)) {
                                insertCols.push(colName);
                                selectExprs.push(`${quoteIdentifier(colName)}`);
                                continue;
                            }

                            // Column does not exist in the old table; omit it from INSERT so SQLite defaults apply.
                        }

                        if (insertCols.length > 0) {
                            recreateSQLs.push(
                                `INSERT INTO ${quoteIdentifier(newTableName)} (${insertCols
                                    .map(quoteIdentifier)
                                    .join(', ')}) SELECT ${selectExprs.join(', ')} FROM ${quoteIdentifier(tableName)}`,
                            );
                        }

                        // 3) DROP old table
                        recreateSQLs.push(`DROP TABLE ${quoteIdentifier(tableName)}`);

                        // 4) RENAME new -> original
                        recreateSQLs.push(
                            `ALTER TABLE ${quoteIdentifier(newTableName)} RENAME TO ${quoteIdentifier(tableName)}`,
                        );

                        // Execute recreate statements as a batch/transaction
                        if (verbose) {
                            console.log('Executing destructive migration as batch:');
                            recreateSQLs.forEach((sql) => console.log(`  ${sql}`));
                        }

                        try {
                            if (driver.executeBatch) {
                                // Use batch for atomicity
                                await driver.executeBatch(recreateSQLs);
                            } else {
                                // Fallback: execute one by one (less safe)
                                console.warn(
                                    '⚠️  Driver does not support executeBatch; running statements sequentially (not atomic)',
                                );
                                for (const sql of recreateSQLs) {
                                    await driver.executeRaw(sql);
                                }
                            }
                            if (verbose) console.log(`✅ Successfully recreated table ${tableName}`);
                        } catch (error: any) {
                            const errorMsg = `Failed destructive migration on ${tableName}: ${error.message}`;
                            result.errors.push(errorMsg);
                            console.error(`❌ ${errorMsg}`);
                        }
                    }
                }
            }
        }

        // Run custom migrations
        if (customMigrations.length > 0) {
            // Ensure migration tracking table exists
            const quotedMigrationTable = quoteIdentifier(MIGRATION_TABLE_NAME);
            await driver.executeRaw(`
        CREATE TABLE IF NOT EXISTS ${quotedMigrationTable} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          executed_at INTEGER NOT NULL,
          driver_type TEXT DEFAULT 'd1-drizzle'
        )
      `);

            for (const migration of customMigrations) {
                // Check if already executed
                const existingResult = await driver.executeRaw(
                    `SELECT name FROM ${quotedMigrationTable} WHERE name = ?`,
                    [migration.name],
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
                            `INSERT INTO ${quotedMigrationTable} (name, executed_at) VALUES (?, ?)`,
                            [migration.name, Date.now()],
                        );

                        result.customMigrationsRun.push(migration.name);
                    } catch (error: any) {
                        const errorMsg = `Failed to run migration ${migration.name}: ${error.message}`;
                        result.errors.push(errorMsg);
                        console.error(`❌ ${errorMsg}`);
                    }
                } else {
                    if (verbose) {
                        console.log(`⏭️  Skipping already executed migration: ${migration.name}`);
                    }
                    result.customMigrationsSkipped.push(migration.name);
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
    customMigrations?: Array<{
        name: string;
        up: (db: DbDriver) => Promise<void>;
    }>,
    options?: { allowDestructive?: boolean; renameMap?: Record<string, Record<string, string>> },
): Promise<{
    success: boolean;
    message: string;
    details: {
        tablesCreated: string[];
        columnsAdded: string[];
        customMigrationsRun: string[];
        customMigrationsSkipped: string[];
        tablesSkipped: string[];
        errors: string[];
    };
}> {
    const result = await autoMigrate({
        driver,
        tables,
        customMigrations,
        verbose: true,
        allowDestructive: options?.allowDestructive,
        renameMap: options?.renameMap,
    });

    const { tablesCreated, columnsAdded, customMigrationsRun, errors } = result;

    const totalChanges = tablesCreated.length + columnsAdded.length + customMigrationsRun.length;

    return {
        success: errors.length === 0,
        message:
            errors.length > 0
                ? `Migrations completed with ${errors.length} error(s)`
                : totalChanges > 0
                  ? `Successfully applied ${totalChanges} change(s)`
                  : 'No changes detected - database is up to date',
        details: result,
    };
}
