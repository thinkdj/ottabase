// ============================================================
// OttaORM - Automatic Initialization
// ============================================================
//
// This module provides a single function to handle all database
// initialization automatically:
// - Auto-detect and create tables from Models
// - Auto-add new columns to existing tables
// - Run custom migrations
//
// Usage: Just call autoInit() and it handles everything!
// ============================================================

import type { DbDriver } from '@ottabase/db';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { runAutoMigrations } from './runtime-generator';
import { Migration } from './index';

export interface AutoInitConfig {
  /**
   * Database driver
   */
  driver: DbDriver;

  /**
   * All Model table schemas
   * Can be imported from Models or from a unified schema file
   *
   * @example
   * import * as schema from './db/schema';
   * autoInit({ driver, schema })
   */
  schema: Record<string, SQLiteTable>;

  /**
   * Custom SQL migrations
   * These run AFTER auto-migration
   *
   * @example
   * customMigrations: [
   *   {
   *     name: '0000_seed_data',
   *     up: async (db) => {
   *       await db.execute(`INSERT INTO ...`);
   *     }
   *   }
   * ]
   */
  customMigrations?: Migration[];

  /**
   * Enable verbose logging
   * Default: true
   */
  verbose?: boolean;
}

/**
 * Automatically initialize database from Models
 *
 * This is the ONE function you need to call to set up your database.
 * It handles:
 * - Creating tables that don't exist
 * - Adding columns to existing tables
 * - Running custom migrations
 *
 * @example
 * // In your /api/ottaorm/init route:
 * import { autoInit } from '@ottabase/ottaorm/migrations';
 * import * as schema from './db/schema';
 * import { customMigrations } from './migrations';
 *
 * const result = await autoInit({
 *   driver: createD1Driver(env.OBCF_D1),
 *   schema,
 *   customMigrations
 * });
 *
 * return Response.json(result);
 */
export async function autoInit(config: AutoInitConfig): Promise<{
  success: boolean;
  message: string;
  details: {
    tablesCreated: string[];
    columnsAdded: string[];
    customMigrationsRun: string[];
    errors: string[];
  };
  timestamp: string;
}> {
  const { driver, schema, customMigrations = [], verbose = true } = config;

  // Basic runtime validation of the schema object to avoid crashes
  const isObject = schema !== null && typeof schema === 'object' && !Array.isArray(schema);
  const schemaKeys = isObject ? Object.keys(schema as object) : [];
  const hasAtLeastOneTable =
    schemaKeys.length > 0 &&
    schemaKeys.some((key) => {
      const value = (schema as any)[key];
      return value !== null && typeof value === 'object';
    });

  if (!isObject || !hasAtLeastOneTable) {
    const message =
      'Invalid schema provided to autoInit: expected a non-empty object mapping table names to SQLiteTable definitions.';

    if (verbose) {
      console.error('🚨 OttaORM Auto-Init aborted:', message);
    }

    return {
      success: false,
      message,
      details: {
        tablesCreated: [],
        columnsAdded: [],
        customMigrationsRun: [],
        errors: [message],
      },
      timestamp: new Date().toISOString(),
    };
  }

  if (verbose) {
    console.log('🚀 OttaORM Auto-Init Starting...\n');
    console.log(`📊 Schema contains ${schemaKeys.length} table(s)`);
    console.log(`🔧 Custom migrations: ${customMigrations.length}\n`);
  }

  // Run auto-migrations
  const result = await runAutoMigrations(driver, schema, customMigrations);

  if (verbose) {
    console.log('\n✅ Auto-Init Complete!\n');
    console.log('Summary:');
    console.log(`  Tables created: ${result.details.tablesCreated.length}`);
    console.log(`  Columns added: ${result.details.columnsAdded.length}`);
    console.log(`  Custom migrations: ${result.details.customMigrationsRun.length}`);

    if (result.details.errors.length > 0) {
      console.log(`  Errors: ${result.details.errors.length}`);
      result.details.errors.forEach(err => console.error(`    ❌ ${err}`));
    }
  }

  return {
    ...result,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to collect all table schemas from imported models
 *
 * This scans an object for properties ending with 'Table' and
 * returns them as a Record<string, SQLiteTable>
 *
 * @example
 * import * as schema from './db/schema';
 * const tables = collectTableSchemas(schema);
 */
export function collectTableSchemas(schemaObject: Record<string, unknown>): Record<string, SQLiteTable>;
export function collectTableSchemas(schemaObject: any): Record<string, SQLiteTable>;
export function collectTableSchemas(schemaObject: Record<string, unknown> | any): Record<string, SQLiteTable> {
  const tables: Record<string, SQLiteTable> = {};

  // Runtime validation to handle any type safely
  if (!schemaObject || typeof schemaObject !== 'object' || Array.isArray(schemaObject)) {
    return tables;
  }

  for (const [key, value] of Object.entries(schemaObject)) {
    // Check if this is a table (convention: ends with 'Table') and has a table-like shape
    if (key.endsWith('Table') && isSQLiteTableLike(value)) {
      tables[key] = value;
    }
  }

  return tables;
}

/**
 * Type guard to check if a value is a SQLite table-like object
 * Uses duck typing to check for Drizzle table characteristics
 */
function isSQLiteTableLike(value: unknown): value is SQLiteTable {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  // Drizzle tables have these characteristics:
  // - name: string (table name)
  // - They are not plain objects (have symbols or are class instances)
  return (
    'name' in obj &&
    typeof obj.name === 'string' &&
    // Check that it's not a plain object literal
    (Object.getOwnPropertySymbols(obj).length > 0 || obj.constructor !== Object)
  );
}
