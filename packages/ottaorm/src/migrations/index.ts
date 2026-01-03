// ============================================================
// @ottabase/ottaorm - Migration System
// ============================================================
// Supports core migrations + per-app migrations
// Now includes automatic runtime migration generation!
// ============================================================

import type { DbDriver } from "@ottabase/db/drizzle";

// Export runtime migration generator
export { autoMigrate, runAutoMigrations, type RuntimeMigrationConfig } from './runtime-generator';

// Export automatic initialization (THE MAIN API!)
export { autoInit, collectTableSchemas, type AutoInitConfig } from './auto-init';

/**
 * Migration interface
 */
export interface Migration {
  name: string;           // Unique migration name (e.g., '001_create_users')
  up: (db: any) => Promise<void>;    // Run migration
  down?: (db: any) => Promise<void>; // Rollback migration (optional)
}

/**
 * Create migrations tracking table
 */
async function createMigrationsTable(db: any): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _ottabase_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at INTEGER NOT NULL,
      driver_type TEXT NOT NULL DEFAULT 'd1-drizzle'
    )
  `);
}

/**
 * Check if migration has been run
 */
async function hasMigrationRun(db: any, name: string): Promise<boolean> {
  try {
    const result = await db.execute(`
      SELECT 1 FROM _ottabase_migrations WHERE name = '${name}' LIMIT 1
    `);
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Record migration as run
 */
async function recordMigration(db: any, name: string, driverType: string = 'd1-drizzle'): Promise<void> {
  const now = Date.now();
  await db.execute(`
    INSERT INTO _ottabase_migrations (name, executed_at, driver_type)
    VALUES ('${name}', ${now}, '${driverType}')
  `);
}

/**
 * Run migrations
 *
 * @example
 * ```typescript
 * import { runMigrations, coreMigrations } from "@ottabase/ottaorm/migrations";
 * import { appMigrations } from "./migrations";
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * const driver = createD1Driver(env.OBCF_D1);
 *
 * // Run core + app migrations
 * await runMigrations(driver, [...coreMigrations, ...appMigrations]);
 * ```
 */
export async function runMigrations(
  driver: DbDriver,
  migrations: Migration[]
): Promise<{ executed: string[]; skipped: string[] }> {
  const db = driver.getDb();

  // Ensure migrations table exists
  await createMigrationsTable(db);

  const executed: string[] = [];
  const skipped: string[] = [];

  console.log(`🔄 Running migrations...`);

  for (const migration of migrations) {
    const hasRun = await hasMigrationRun(db, migration.name);

    if (hasRun) {
      console.log(`⏭️  Skipping: ${migration.name} (already run)`);
      skipped.push(migration.name);
      continue;
    }

    try {
      console.log(`⚡ Executing: ${migration.name}`);
      await migration.up(db);
      await recordMigration(db, migration.name);
      executed.push(migration.name);
      console.log(`✅ Completed: ${migration.name}`);
    } catch (error) {
      console.error(`❌ Failed: ${migration.name}`, error);
      throw new Error(`Migration ${migration.name} failed: ${error}`);
    }
  }

  if (executed.length > 0) {
    console.log(`\n✨ Executed ${executed.length} migration(s)`);
  } else {
    console.log(`\n✨ All migrations up to date`);
  }

  return { executed, skipped };
}

/**
 * Rollback migrations
 * USE WITH CAUTION - This will delete data
 */
export async function rollbackMigrations(
  driver: DbDriver,
  migrations: Migration[],
  options?: { steps?: number } // Number of migrations to rollback (default: all)
): Promise<{ rolledBack: string[] }> {
  const db = driver.getDb();
  const rolledBack: string[] = [];

  // Get all executed migrations
  const result = await db.execute(`
    SELECT name FROM _ottabase_migrations ORDER BY executed_at DESC
  `);

  const executedMigrations = result.map((row: any) => row.name);
  const steps = options?.steps || executedMigrations.length;

  console.log(`🔄 Rolling back ${steps} migration(s)...`);

  for (let i = 0; i < Math.min(steps, executedMigrations.length); i++) {
    const migrationName = executedMigrations[i];
    const migration = migrations.find(m => m.name === migrationName);

    if (!migration) {
      console.warn(`⚠️  Migration ${migrationName} not found in provided migrations`);
      continue;
    }

    if (!migration.down) {
      console.warn(`⚠️  Migration ${migrationName} has no down() method`);
      continue;
    }

    try {
      console.log(`⚡ Rolling back: ${migrationName}`);
      await migration.down(db);
      await db.execute(`DELETE FROM _ottabase_migrations WHERE name = '${migrationName}'`);
      rolledBack.push(migrationName);
      console.log(`✅ Rolled back: ${migrationName}`);
    } catch (error) {
      console.error(`❌ Failed to rollback: ${migrationName}`, error);
      throw new Error(`Rollback of ${migrationName} failed: ${error}`);
    }
  }

  console.log(`\n✨ Rolled back ${rolledBack.length} migration(s)`);

  return { rolledBack };
}

// ============================================================
// CORE MIGRATIONS (from ottaorm package)
// ============================================================

export const coreMigrations: Migration[] = [
  {
    name: "001_create_users_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT NOT NULL UNIQUE,
          image TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS users`);
    },
  },
  {
    name: "002_create_accounts_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_account_id TEXT NOT NULL,
          refresh_token TEXT,
          access_token TEXT,
          expires_at INTEGER,
          token_type TEXT,
          scope TEXT,
          id_token TEXT,
          session_state TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(provider, provider_account_id)
        )
      `);
      // Index for faster lookups
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`,
      );
    },
    down: async (db) => {
      await db.execute(`DROP INDEX IF EXISTS idx_accounts_user_id`);
      await db.execute(`DROP TABLE IF EXISTS accounts`);
    },
  },
  {
    name: "003_create_posts_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          content TEXT,
          excerpt TEXT,
          published INTEGER NOT NULL DEFAULT 0,
          author_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS posts`);
    },
  },
  {
    name: "004_create_tags_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS tags`);
    },
  },
  {
    name: "005_create_post_tags_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS post_tags (
          post_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (post_id, tag_id)
        )
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS post_tags`);
    },
  },
  {
    name: "006_create_sessions_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          session_token TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          expires TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)`,
      );
    },
    down: async (db) => {
      await db.execute(`DROP INDEX IF EXISTS idx_sessions_token`);
      await db.execute(`DROP INDEX IF EXISTS idx_sessions_user_id`);
      await db.execute(`DROP TABLE IF EXISTS sessions`);
    },
  },
  {
    name: "007_create_verification_tokens_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS verification_tokens (
          identifier TEXT NOT NULL,
          token TEXT NOT NULL,
          expires TEXT NOT NULL,
          PRIMARY KEY (identifier, token)
        )
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS verification_tokens`);
    },
  },
  {
    name: "008_create_authenticators_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS authenticators (
          id TEXT PRIMARY KEY,
          credential_id TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          provider_account_id TEXT NOT NULL,
          credential_public_key TEXT NOT NULL,
          counter INTEGER NOT NULL,
          credential_device_type TEXT NOT NULL,
          credential_backed_up INTEGER NOT NULL,
          transports TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id)`,
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id)`,
      );
    },
    down: async (db) => {
      await db.execute(`DROP INDEX IF EXISTS idx_authenticators_credential_id`);
      await db.execute(`DROP INDEX IF EXISTS idx_authenticators_user_id`);
      await db.execute(`DROP TABLE IF EXISTS authenticators`);
    },
  },
];
