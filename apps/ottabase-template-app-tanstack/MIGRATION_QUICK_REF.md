# Migration Quick Reference Guide

## 🚀 Common Tasks

### 1. Run Migrations (Development)

```bash
# Start dev server
pnpm dev

# In another terminal, trigger migrations:
curl -X POST http://127.0.0.1:3004/api/ottaorm/init

# Or just visit in browser:
http://127.0.0.1:3004/migration-status
```

### 2. Run Migrations (Production)

```bash
curl -X POST https://your-app.workers.dev/api/ottaorm/init?secret=YOUR_SECRET

# Or with header:
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer YOUR_SECRET"
```

### 3. Add a New App Table

**Step 1:** Create the model (`ottabase/models/Example.ts`)

```typescript
import { BaseModel } from '@ottabase/ottaorm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const examplesTable = sqliteTable('examples', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export class Example extends BaseModel {
    static table = examplesTable;
    static tableName = 'examples';
}
```

**Step 2:** Export from schema (`ottabase/db/schema.ts`)

```typescript
export { examplesTable } from '../models/Example';
```

**Step 3:** Run migrations

```bash
curl -X POST http://127.0.0.1:3004/api/ottaorm/init
```

Done! ✅

### 4. Add a Column to Existing Table

**Step 1:** Update the model

```typescript
export const todosTable = sqliteTable('todos', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    userId: text('user_id'),
    // NEW COLUMN:
    priority: text('priority').default('medium'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

**Step 2:** Run migrations

```bash
curl -X POST http://127.0.0.1:3004/api/ottaorm/init
```

The column will be automatically added! ✅

### 5. Enable a Package

**Step 1:** Edit `ottabase/config.migrations.ts`

```typescript
import { shortlinksTable } from '@ottabase/shortlinks';
import { myNewPackageTable } from '@ottabase/my-new-package/schema';

const PACKAGE_REGISTRY = {
    shortlinks: {
        tables: { shortlinksTable },
        migrations: [],
    },
    myNewPackage: {
        // ADD THIS
        tables: { myNewPackageTable },
        migrations: [],
    },
} as const;

export const migrationConfig = {
    shortlinks: true,
    myNewPackage: true, // ENABLE IT
};
```

**Step 2:** Run migrations

```bash
curl -X POST http://127.0.0.1:3004/api/ottaorm/init
```

Package tables created! ✅

### 6. Add Custom Migration (Data Seeding)

**Edit `ottabase/migrations/index.ts`:**

```typescript
const appSpecificMigrations: Migration[] = [
    {
        name: '0001_seed_demo_todos',
        up: async (db) => {
            await db.executeRaw(`
        INSERT OR IGNORE INTO todos (id, title, completed, created_at, updated_at)
        VALUES 
          ('todo-1', 'First demo todo', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
          ('todo-2', 'Second demo todo', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
      `);
        },
    },
];
```

Run migrations - data will be seeded once! ✅

### 7. Add Custom Index

```typescript
const appSpecificMigrations: Migration[] = [
    {
        name: '0002_create_user_email_index',
        up: async (db) => {
            await db.executeRaw(`
        CREATE INDEX IF NOT EXISTS idx_users_email 
        ON users(email)
      `);
        },
    },
];
```

### 8. Check Migration Status

Visit: `http://127.0.0.1:3004/migration-status`

You'll see:

- ✅ All tables detected
- 🆕 Tables created
- ⏭️ Tables skipped (already exist)
- ➕ Columns added
- ⚡ Migrations run
- ❌ Any errors

### 9. Deploy to Production

```bash
# 1. Deploy the app
pnpm deploy

# 2. Run migrations (with secret)
curl -X POST https://your-app.workers.dev/api/ottaorm/init?secret=$MIGRATION_SECRET

# 3. Check status
open https://your-app.workers.dev/migration-status
```

### 10. Disable a Package

**Edit `ottabase/config.migrations.ts`:**

```typescript
export const migrationConfig = {
    shortlinks: false, // Disable it
};
```

Note: This won't drop the tables, just stops managing them.

## 📝 File Quick Reference

### Where to Make Changes

| Task              | File                            | Line/Section            |
| ----------------- | ------------------------------- | ----------------------- |
| Add app table     | `ottabase/models/YourModel.ts`  | Create new file         |
| Export table      | `ottabase/db/schema.ts`         | Add export              |
| Enable package    | `ottabase/config.migrations.ts` | `migrationConfig`       |
| Add package       | `ottabase/config.migrations.ts` | `PACKAGE_REGISTRY`      |
| Custom migration  | `ottabase/migrations/index.ts`  | `appSpecificMigrations` |
| Check all schemas | `ottabase/db/schemas-helper.ts` | `getAllSchemas()`       |

## 🔍 Troubleshooting Quick Fixes

### Table not appearing?

```bash
# Check it's exported:
grep "YourTable" ottabase/db/schema.ts

# Check migration status:
curl -X POST http://127.0.0.1:3004/api/ottaorm/init
```

### Package not working?

```typescript
// In config.migrations.ts, verify:
1. Package imported correctly
2. Added to PACKAGE_REGISTRY
3. Set to true in migrationConfig
```

### Migration running multiple times?

```typescript
// Ensure unique name:
{
  name: "0001_unique_name_here",  // Must be unique!
  up: async (db) => { ... }
}
```

### Need to see what's in the database?

```bash
# Use wrangler d1:
wrangler d1 execute OBCF_D1 --local --command "SELECT * FROM _ottabase_migrations"

# Or Drizzle Studio:
pnpm db:studio
```

## 🎯 Best Practices Checklist

- [ ] Test migrations locally with `wrangler dev` first
- [ ] Use descriptive migration names: `0001_add_user_roles`
- [ ] Make migrations idempotent (use `OR IGNORE`, `IF NOT EXISTS`)
- [ ] Check `/migration-status` after running
- [ ] Never edit executed migrations - create new ones
- [ ] Keep custom migrations for data/indexes only (tables are auto-created)

## 📚 More Info

- Full documentation: `ottabase/migrations/README.md`
- Architecture diagrams: `MIGRATION_ARCHITECTURE.md`
- Implementation summary: `MIGRATION_SYSTEM_SUMMARY.md`

## 🆘 Getting Help

If something's not working:

1. Check `/migration-status` for error details
2. Look at browser console / wrangler logs
3. Verify file changes are saved
4. Ensure schema exports are correct
5. Check `_ottabase_migrations` table for history

---

The OttaORM migration system:

- ✅ Creates essential tables via bootstrap process (10 core migrations)
- ✅ Automatically detects and creates tables from Models (core + packages + app)
- ✅ Transparently handles model changes without manual intervention
- ✅ Safely manages destructive operations with proper guardrails
- ✅ Tracks migrations to ensure idempotency

## Architecture Overview

### Core Components

1. **`auto-init.ts`** - Main API for automatic database initialization
    - Location: `packages/ottaorm/src/migrations/auto-init.ts`
    - Function: `autoInit(config)` - Single function to initialize entire database
    - Validates schema, runs auto-migrations, executes custom migrations

2. **`runtime-generator.ts`** - Runtime schema comparison and migration generation
    - Location: `packages/ottaorm/src/migrations/runtime-generator.ts`
    - Functions: `autoMigrate()`, `runAutoMigrations()`
    - Handles: Table creation, column addition, destructive operations

3. **`index.ts`** - Core migrations and migration runner
    - Location: `packages/ottaorm/src/migrations/index.ts`
    - Contains: 10 core migrations for essential tables
    - Functions: `runMigrations()`, `rollbackMigrations()`

**TanStack/Cloudflare Worker App:**

- Route: `apps/ottabase-template-app-tanstack/worker/routes/ottaorm-init.ts`
- Uses: `getAllSchemas()` helper to combine core + app + package tables
- Helper: `apps/ottabase-template-app-tanstack/ottabase/db/schemas-helper.ts`

---

## Bootstrap Process Verification

### Core Migrations (10 Essential Tables)

The bootstrap process successfully creates all essential tables through core migrations:

1. **001_create_users_table** - User accounts (users:211-228)
2. **002_create_accounts_table** - OAuth/provider accounts (users:229-258)
3. **003_create_posts_table** - Blog posts (users:259-278)
4. **004_create_tags_table** - Content tags (users:280-295)
5. **005_create_post_tags_table** - Many-to-many junction (users:297-312)
6. **006_create_sessions_table** - User sessions with indexes (users:313-334)
7. **007_create_verification_tokens_table** - Email verification (users:335-350)
8. **008_create_authenticators_table** - WebAuthn/passkey credentials (users:351-379)
9. **009_add_rbac_and_audit** - RBAC system (roles, permissions, user_roles, audit_logs) (users:380-517)
10. **010_multi_tenant_system** - Multi-tenancy (organizations, organization_members) (users:518-687)

### Model Detection from All Sources

The system successfully detects and processes models from three sources:

#### 1. **Core Models** (from `@ottabase/ottaorm`)

- Location: `/home/user/ottabase/packages/ottaorm/src/models/`
- Tables: `usersTable`, `accountsTable`, `sessionsTable`, `authenticatorsTable`, `verificationTokensTable`, `tagsTable`,
  `scheduledTasksTable`, `rolesTable`, `permissionsTable`, `userRolesTable`, `auditLogsTable`, `organizationsTable`,
  `organizationMembersTable`
- Example: User model at User.ts:30, table at User.schema.ts

#### 2. **Package Models** (from enabled packages)

- Configured via: `/home/user/ottabase/apps/ottabase-template-app-tanstack/ottabase/config.migrations.ts`
- Registry includes:
    - **ottablog**: `postsTable`, `categoriesTable`, `seriesTable`, `postTagsTable`, `postTagLinksTable`,
      `postVersionsTable`, `ottablogPluginsTable`, `ottablogThemesTable`
    - **shortlinks**: `shortlinksTable`
    - **referrals**: `referralTrackingTable`
- Function: `getEnabledPackageTables()` dynamically includes tables based on config (config.migrations.ts:76-86)

#### 3. **App Models** (app-specific)

- Location: `/home/user/ottabase/apps/ottabase-template-app-tanstack/ottabase/models/`
- Example: Todo model at Todo.ts:33, table at Todo.schema.ts:10
- Table naming convention: `todosTable` (ends with "Table")

### Auto-Detection Mechanism

The system uses two approaches for schema collection:

1. **`collectTableSchemas()`** (auto-init.ts:190-208)
    - Scans schema object for properties ending with "Table"
    - Uses duck typing to verify SQLite table characteristics
    - Returns: `Record<string, SQLiteTable>`

2. **`getAllSchemas()`** (schemas-helper.ts:40-77)
    - Manually combines core + app + package tables
    - Provides explicit control over table inclusion
    - Returns: Combined schema object

---

### Runtime Migration Process

The automatic migration process works as follows:

1. **Table Detection** (runtime-generator.ts:122-148)

    ```sql
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_ottabase_%'
    ```

2. **Column Detection** (runtime-generator.ts:153-172)

    ```sql
    PRAGMA table_info("table_name")
    ```

3. **Schema Comparison**
    - New tables → `CREATE TABLE IF NOT EXISTS` (runtime-generator.ts:252-268)
    - New columns → `ALTER TABLE ... ADD COLUMN` (runtime-generator.ts:274-313)
    - Removed columns → Detected, requires `allowDestructive: true` (runtime-generator.ts:314-398)

4. **Migration Tracking**
    - Table: `_ottabase_migrations` (runtime-generator.ts:19, 404-412)
    - Ensures idempotency - migrations run only once
    - Tracks: name, executed_at, driver_type

---

## Safety Features

### Destructive Operations Handling

The system provides multiple layers of protection:

1. **Default Behavior: Block Destructive Operations**
    - Column removal detected but **blocked by default** (runtime-generator.ts:319-322)
    - Warns user with error message
    - Returns error in result

2. **Explicit Flag Required**
    - Set `allowDestructive: true` to enable (auto-init.ts:105)
    - Available via env: `MIGRATION_ALLOW_DESTRUCTIVE=true` (ottaorm-init.ts:55-56)

3. **Table Recreation Strategy** (runtime-generator.ts:330-395) When destructive operations are enabled:
    - Step 1: `CREATE TABLE table__new` with desired schema
    - Step 2: `INSERT INTO table__new SELECT ... FROM table` (with column mapping)
    - Step 3: `DROP TABLE table`
    - Step 4: `ALTER TABLE table__new RENAME TO table`

4. **Column Rename Support**
    - Parameter: `renameMap` (auto-init.ts:65)
    - Example: `{ posts: { old_col: 'new_col' } }`
    - Preserves data during column renames (runtime-generator.ts:344-351)

---

## API Routes & Usage

### Initialization Endpoint

**Both apps expose:** `POST /api/ottaorm/init`

**Authentication:**

- Development: No auth required
- Production: Requires `MIGRATION_SECRET`
- Methods: Query param, POST body, or Bearer token

**Response Format:**

```json
{
  "success": boolean,
  "message": string,
  "details": {
    "tablesCreated": string[],
    "columnsAdded": string[],
    "customMigrationsRun": string[],
    "customMigrationsSkipped": string[],
    "tablesDetected": string[],
    "tablesSkipped": string[],
    "errors": string[]
  },
  "timestamp": number
}
```

---

## Model Examples

### Core Model (User)

**Location:** `/home/user/ottabase/packages/ottaorm/src/models/User.ts`

- Class definition: User.ts:30
- Table export: `usersTable` from User.schema.ts
- Extends: `BaseModel`
- Package type: `'core'`

### App Model (Todo)

**Location:** `/home/user/ottabase/apps/ottabase-template-app-tanstack/ottabase/models/Todo.ts`

- Class definition: Todo.ts:33
- Table schema: Todo.schema.ts:10-24
- Table name: `todos`
- Package type: `'app'`

**Table Schema Example:**

```typescript
export const todosTable = sqliteTable('todos', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
    userId: text('user_id'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

---

## Limitations & Best Practices

### Known SQLite Limitations

1. **Cannot add NOT NULL columns without DEFAULT**
    - Handled: System warns and skips (runtime-generator.ts:206-210)
    - Solution: Add DEFAULT value to column definition

2. **Cannot change column types**
    - Solution: Use custom migration with table recreation

3. **Cannot rename columns without renameMap**
    - Solution: Provide `renameMap` parameter to preserve data

### Best Practices

1. **Always test migrations in development first**
2. **Use `allowDestructive` only when necessary**
3. **Provide `renameMap` for column renames to preserve data**
4. **Keep custom migrations idempotent**
5. **Use descriptive migration names** (e.g., `001_create_users_table`)

---
