// ============================================================
// @ottabase/ottaorm - Migration System
// ============================================================
// Supports core migrations + per-app migrations
// Now includes automatic runtime migration generation!
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';

// Export runtime migration generator
export { autoMigrate, runAutoMigrations, type RuntimeMigrationConfig } from './runtime-generator';

// Export automatic initialization (THE MAIN API!)
export { autoInit, collectTableSchemas, type AutoInitConfig } from './auto-init';

/**
 * Migration interface
 */
export interface Migration {
    name: string; // Unique migration name (e.g., '001_create_users')
    up: (db: any) => Promise<void>; // Run migration
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
async function hasMigrationRun(driver: DbDriver, name: string): Promise<boolean> {
    try {
        const result = await driver.executeRaw(`SELECT 1 FROM _ottabase_migrations WHERE name = ? LIMIT 1`, [name]);
        // Handle D1 response { results: [], ... }
        if (result && typeof result === 'object' && 'results' in result && Array.isArray(result.results)) {
            return result.results.length > 0;
        }
        // Handle standard array response
        if (Array.isArray(result)) {
            return result.length > 0;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Record migration as run
 */
async function recordMigration(driver: DbDriver, name: string, driverType: string = 'd1-drizzle'): Promise<void> {
    const now = Date.now();
    await driver.executeRaw(`INSERT INTO _ottabase_migrations (name, executed_at, driver_type) VALUES (?, ?, ?)`, [
        name,
        now,
        driverType,
    ]);
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
    migrations: Migration[],
): Promise<{ executed: string[]; skipped: string[] }> {
    // Create an adapter that assumes D1-like response structure but returns array
    // This bridges the gap between raw SQL execution and what migrations expect
    const db = {
        execute: async (sql: string) => {
            const result = await driver.executeRaw(sql);
            // Handle D1 response { results: [], ... }
            if (result && typeof result === 'object' && 'results' in result && Array.isArray(result.results)) {
                return result.results;
            }
            // Handle standard array response
            if (Array.isArray(result)) {
                return result;
            }
            return [];
        },
    };

    // Ensure migrations table exists
    await createMigrationsTable(db);

    const executed: string[] = [];
    const skipped: string[] = [];

    console.log(`🔄 Running migrations...`);

    for (const migration of migrations) {
        const hasRun = await hasMigrationRun(driver, migration.name);

        if (hasRun) {
            console.log(`⏭️  Skipping: ${migration.name} (already run)`);
            skipped.push(migration.name);
            continue;
        }

        try {
            console.log(`⚡ Executing: ${migration.name}`);
            await migration.up(db);
            await recordMigration(driver, migration.name);
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
    options?: { steps?: number }, // Number of migrations to rollback (default: all)
): Promise<{ rolledBack: string[] }> {
    // Same adapter as runMigrations
    const db = {
        execute: async (sql: string) => {
            const result = await driver.executeRaw(sql);
            if (result && typeof result === 'object' && 'results' in result && Array.isArray(result.results)) {
                return result.results;
            }
            if (Array.isArray(result)) {
                return result;
            }
            return [];
        },
    };

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
        const migration = migrations.find((m) => m.name === migrationName);

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
            await driver.executeRaw(`DELETE FROM _ottabase_migrations WHERE name = ?`, [migrationName]);
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
        name: '001_create_users_table',
        up: async (db) => {
            await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT NOT NULL UNIQUE,
                    email_verified INTEGER,
          image TEXT,
          password_hash TEXT,
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
        name: '002_create_accounts_table',
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
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
        },
        down: async (db) => {
            await db.execute(`DROP INDEX IF EXISTS idx_accounts_user_id`);
            await db.execute(`DROP TABLE IF EXISTS accounts`);
        },
    },
    {
        name: '003_create_posts_table',
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
        name: '004_create_tags_table',
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
        name: '005_create_post_tags_table',
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
        name: '006_create_sessions_table',
        up: async (db) => {
            await db.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          session_token TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
                    expires INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)`);
        },
        down: async (db) => {
            await db.execute(`DROP INDEX IF EXISTS idx_sessions_token`);
            await db.execute(`DROP INDEX IF EXISTS idx_sessions_user_id`);
            await db.execute(`DROP TABLE IF EXISTS sessions`);
        },
    },
    {
        name: '007_create_verification_tokens_table',
        up: async (db) => {
            await db.execute(`
        CREATE TABLE IF NOT EXISTS verification_tokens (
          identifier TEXT NOT NULL,
          token TEXT NOT NULL,
                    expires INTEGER NOT NULL,
          PRIMARY KEY (identifier, token)
        )
      `);
        },
        down: async (db) => {
            await db.execute(`DROP TABLE IF EXISTS verification_tokens`);
        },
    },
    {
        name: '008_create_authenticators_table',
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
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id)`);
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
    {
        name: '009_add_rbac_and_audit',
        up: async (db) => {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS roles (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    permissions TEXT NOT NULL DEFAULT '[]',
                    is_system INTEGER DEFAULT 0 NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS permissions (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    resource TEXT NOT NULL,
                    action TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS user_roles (
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                    organization_id TEXT,
                    assigned_at INTEGER NOT NULL,
                    assigned_by TEXT,
                    PRIMARY KEY (user_id, role_id)
                )
            `);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                    user_email TEXT,
                    organization_id TEXT,
                    action TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT,
                    changes TEXT,
                    metadata TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    status TEXT DEFAULT 'success' NOT NULL,
                    error_message TEXT,
                    created_at INTEGER NOT NULL
                )
            `);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status)`);
            await db.execute(`
                INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at) VALUES
                    (
                        '00000000-0000-0000-0000-000000000001',
                        'admin',
                        'Full system access',
                        '["*:*"]',
                        1,
                        (unixepoch() * 1000),
                        (unixepoch() * 1000)
                    ),
                    (
                        '00000000-0000-0000-0000-000000000002',
                        'editor',
                        'Can create and edit content',
                        '["*:read","*:create","*:update"]',
                        1,
                        (unixepoch() * 1000),
                        (unixepoch() * 1000)
                    ),
                    (
                        '00000000-0000-0000-0000-000000000003',
                        'viewer',
                        'Read-only access',
                        '["*:read"]',
                        1,
                        (unixepoch() * 1000),
                        (unixepoch() * 1000)
                    )
            `);
            await db.execute(`
                INSERT OR IGNORE INTO permissions (id, name, description, resource, action, created_at, updated_at) VALUES
                    (hex(randomblob(16)), 'users:read', 'Read users', 'users', 'read', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'users:create', 'Create users', 'users', 'create', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'users:update', 'Update users', 'users', 'update', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'users:delete', 'Delete users', 'users', 'delete', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'roles:read', 'Read roles', 'roles', 'read', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'roles:create', 'Create roles', 'roles', 'create', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'roles:update', 'Update roles', 'roles', 'update', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'roles:delete', 'Delete roles', 'roles', 'delete', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'audit:read', 'Read audit logs', 'audit', 'read', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), 'audit:export', 'Export audit logs', 'audit', 'export', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), '*:*', 'All permissions', '*', '*', (unixepoch() * 1000), (unixepoch() * 1000)),
                    (hex(randomblob(16)), '*:read', 'Read all resources', '*', 'read', (unixepoch() * 1000), (unixepoch() * 1000))
            `);
        },
        down: async (db) => {
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_status`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_action`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_created_at`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_resource_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_resource_type`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_organization_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_user_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_organization_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_role_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_user_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_permissions_resource_action`);
            await db.execute(`DROP INDEX IF EXISTS idx_permissions_name`);
            await db.execute(`DROP INDEX IF EXISTS idx_roles_name`);
            await db.execute(`DROP TABLE IF EXISTS audit_logs`);
            await db.execute(`DROP TABLE IF EXISTS user_roles`);
            await db.execute(`DROP TABLE IF EXISTS permissions`);
            await db.execute(`DROP TABLE IF EXISTS roles`);
        },
    },
    {
        /** Implements: Tenant > App > User hierarchy  */
        name: '010_multi_tenant_system',
        up: async (db) => {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS organizations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    slug TEXT NOT NULL UNIQUE,
                    owner_id TEXT,
                    plan TEXT DEFAULT 'free',
                    status TEXT DEFAULT 'active',
                    settings TEXT,
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan)`);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS organization_members (
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL DEFAULT 'member',
                    status TEXT NOT NULL DEFAULT 'active',
                    invited_by TEXT,
                    invited_at INTEGER,
                    joined_at INTEGER NOT NULL,
                    metadata TEXT,
                    PRIMARY KEY (user_id, organization_id)
                )
            `);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members(organization_id)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status)`);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS user_roles_new (
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                    organization_id TEXT NOT NULL,
                    app_id TEXT,
                    assigned_at INTEGER NOT NULL,
                    assigned_by TEXT,
                    PRIMARY KEY (user_id, role_id, organization_id)
                )
            `);
            await db.execute(`
                INSERT INTO user_roles_new (user_id, role_id, organization_id, app_id, assigned_at, assigned_by)
                SELECT
                    user_id,
                    role_id,
                    COALESCE(organization_id, 'default-org'),
                    NULL as app_id,
                    assigned_at,
                    assigned_by
                FROM user_roles
                WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_roles')
            `);
            await db.execute(`DROP TABLE IF EXISTS user_roles`);
            await db.execute(`ALTER TABLE user_roles_new RENAME TO user_roles`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_roles_app_id ON user_roles(app_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_user_roles_user_org ON user_roles(user_id, organization_id)`,
            );
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_user_roles_user_org_app ON user_roles(user_id, organization_id, app_id)`,
            );
            await db.execute(`
                CREATE TABLE IF NOT EXISTS audit_logs_new (
                    id TEXT PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                    user_email TEXT,
                    organization_id TEXT,
                    app_id TEXT,
                    action TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT,
                    changes TEXT,
                    metadata TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    status TEXT NOT NULL DEFAULT 'success',
                    error_message TEXT,
                    created_at INTEGER NOT NULL
                )
            `);
            await db.execute(`
                INSERT INTO audit_logs_new (
                    id, user_id, user_email, organization_id, app_id, action, resource_type,
                    resource_id, changes, metadata, ip_address, user_agent, status, error_message, created_at
                )
                SELECT
                    id, user_id, user_email, organization_id,
                    NULL as app_id,
                    action, resource_type, resource_id, changes, metadata,
                    ip_address, user_agent, status, error_message, created_at
                FROM audit_logs
                WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_logs')
            `);
            await db.execute(`DROP TABLE IF EXISTS audit_logs`);
            await db.execute(`ALTER TABLE audit_logs_new RENAME TO audit_logs`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_app_id ON audit_logs(app_id)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id)`,
            );
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at)`,
            );
            await db.execute(
                `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org ON audit_logs(user_id, organization_id)`,
            );
            await db.execute(`
                INSERT OR IGNORE INTO organizations (id, name, slug, plan, status, created_at, updated_at)
                VALUES (
                    'default-org',
                    'Default Organization',
                    'default',
                    'free',
                    'active',
                    (unixepoch() * 1000),
                    (unixepoch() * 1000)
                )
            `);
        },
        down: async (db) => {
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_user_org`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_org_created`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_created_at`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_action`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_resource`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_app_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_organization_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_audit_logs_user_id`);
            await db.execute(`DROP TABLE IF EXISTS audit_logs`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_user_org_app`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_user_org`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_app_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_organization_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_role_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_user_roles_user_id`);
            await db.execute(`DROP TABLE IF EXISTS user_roles`);
            await db.execute(`DROP INDEX IF EXISTS idx_org_members_status`);
            await db.execute(`DROP INDEX IF EXISTS idx_org_members_role`);
            await db.execute(`DROP INDEX IF EXISTS idx_org_members_organization_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_org_members_user_id`);
            await db.execute(`DROP TABLE IF EXISTS organization_members`);
            await db.execute(`DROP INDEX IF EXISTS idx_organizations_plan`);
            await db.execute(`DROP INDEX IF EXISTS idx_organizations_status`);
            await db.execute(`DROP INDEX IF EXISTS idx_organizations_owner_id`);
            await db.execute(`DROP INDEX IF EXISTS idx_organizations_slug`);
            await db.execute(`DROP TABLE IF EXISTS organizations`);
        },
    },
];
