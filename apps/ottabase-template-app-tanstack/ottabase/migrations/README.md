# Migration System Documentation

## Overview

The OttaBase migration system provides a **simple, automatic, and comprehensive** approach to database migrations that
works across your entire monorepo. It handles:

1. **Core schemas** (from `@ottabase/ottaorm`) - users, auth, posts, etc.
2. **App-specific schemas** - custom tables for your app (like `todos`)
3. **Package schemas** - tables from enabled packages (like `@ottabase/shortlinks`)

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   /api/ottaorm/init                         │
│                (Migration Endpoint)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              schemas-helper.ts                               │
│         Collects all table schemas:                          │
│  • Core (from @ottabase/ottaorm/schema)                     │
│  • App (from ottabase/db/schema.ts)                         │
│  • Packages (from config.migrations.ts)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              autoInit()                                      │
│         (from @ottabase/ottaorm)                            │
│  • Creates missing tables                                   │
│  • Adds new columns                                         │
│  • Runs custom migrations                                   │
│  • Tracks history in _ottabase_migrations                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Migration Status Page                              │
│      Shows detailed migration results                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **`ottabase/config.migrations.ts`**
    - Single source of truth for enabled packages
    - Configure which packages are active
    - Each package can provide tables + custom migrations

2. **`ottabase/db/schemas-helper.ts`**
    - Collects all schemas from different sources
    - Combines core, app, and package schemas
    - Used by the migration endpoint

3. **`ottabase/db/schema.ts`**
    - Exports all table schemas
    - Core tables from `@ottabase/ottaorm`
    - App-specific tables
    - Package tables (via `config.migrations.ts`)

4. **`ottabase/migrations/index.ts`**
    - Custom migrations registry
    - Combines core, app, and package migrations
    - Executed after table creation

5. **`cloudflare-worker.ts` (`/api/ottaorm/init`)**
    - Migration endpoint
    - Calls `autoInit()` with all schemas
    - Returns detailed migration results

## Usage

### Running Migrations

#### Development (wrangler dev)

```bash
curl -X POST http://127.0.0.1:3004/api/ottaorm/init
```

Or navigate to:

```
http://127.0.0.1:3004/migration-status
```

#### Production

```bash
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer YOUR_MIGRATION_SECRET"
```

Or with query parameter:

```bash
curl -X POST https://your-app.workers.dev/api/ottaorm/init?secret=YOUR_MIGRATION_SECRET
```

### Adding a New Table (App-Specific)

1. **Create the Model** (`ottabase/models/YourModel.ts`):

```typescript
import { BaseModel } from '@ottabase/ottaorm';
import { text, integer } from 'drizzle-orm/sqlite-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';

export const yourTable = sqliteTable('your_table', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export class YourModel extends BaseModel {
    static table = yourTable;
    static tableName = 'your_table';
}
```

2. **Export from schema** (`ottabase/db/schema.ts`):

```typescript
export { yourTable } from '../models/YourModel';
```

3. **Run migrations**:

```bash
curl -X POST http://127.0.0.1:3004/api/ottaorm/init
```

That's it! The table will be automatically created.

### Adding a Package

1. **Enable the package** in `ottabase/config.migrations.ts`:

```typescript
import { shortlinksTable } from '@ottabase/shortlinks';
import { shortlinkMigrations } from '@ottabase/shortlinks/migrations';

const PACKAGE_REGISTRY = {
    shortlinks: {
        tables: { shortlinksTable },
        migrations: shortlinkMigrations, // Optional custom migrations
    },
    // Add your package here:
    myPackage: {
        tables: { myPackageTable },
        migrations: myPackageMigrations,
    },
} as const;

export const migrationConfig: Record<MigrationPackageName, boolean> = {
    shortlinks: true,
    myPackage: true, // Enable it
};
```

2. **Run migrations** - the package tables will be created automatically!

### Adding Custom Migrations

For data seeding, indexes, or other custom SQL that can't be expressed in Models:

**In `ottabase/migrations/index.ts`**:

```typescript
const appSpecificMigrations: Migration[] = [
    {
        name: '0001_seed_admin_user',
        up: async (db) => {
            await db.executeRaw(`
        INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
        VALUES (
          'admin-001', 
          'Admin', 
          'admin@example.com',
          strftime('%s', 'now') * 1000, 
          strftime('%s', 'now') * 1000
        )
      `);
        },
    },
    {
        name: '0002_create_custom_index',
        up: async (db) => {
            await db.executeRaw(`
        CREATE INDEX IF NOT EXISTS idx_users_email 
        ON users(email)
      `);
        },
    },
];
```

Migrations are tracked in the `_ottabase_migrations` table and will only run once.

## Migration Tracking

### History Table

All executed migrations are tracked in `_ottabase_migrations`:

```sql
CREATE TABLE _ottabase_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER NOT NULL,
  driver_type TEXT DEFAULT 'd1-drizzle'
);
```

### Checking Migration Status

Navigate to `/migration-status` in your app to see:

- All detected tables (core + app + packages)
- Tables created vs. skipped
- Columns added
- Custom migrations run
- Any errors

## Production Deployment

### Setting Up Migration Secret

1. **In Cloudflare Dashboard** or via `wrangler`:

```bash
wrangler secret put MIGRATION_SECRET
```

2. **Set environment variable**:

```bash
export MIGRATION_SECRET="your-secret-here"
```

3. **Run migrations** with the secret:

```bash
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer your-secret-here"
```

### Deployment Workflow

1. **Deploy your app**:

```bash
pnpm deploy
```

2. **Run migrations** (after deployment):

```bash
curl -X POST https://your-app.workers.dev/api/ottaorm/init?secret=$MIGRATION_SECRET
```

3. **Verify** by checking `/migration-status`

## FAQ

### Q: Do I need to write SQL migrations?

**A:** No! Tables are auto-created from your Models. Only write custom migrations for data seeding, indexes, or other
special SQL.

### Q: How do I add a new column?

**A:** Just add it to your Model and run `/api/ottaorm/init`. It will be automatically added to existing tables.

### Q: What about drizzle-kit?

**A:** You can still use `drizzle-kit push` for schema changes, but `autoInit()` works without any CLI tools - perfect
for serverless.

### Q: Can I use this in local development?

**A:** Yes! It works with both `wrangler dev` (local D1) and production Cloudflare D1.

### Q: What if a migration fails?

**A:** Check the `/migration-status` page for detailed error messages. Failed migrations won't be marked as complete and
will retry next time.

### Q: How do I rollback?

**A:** Currently, there's no automatic rollback. For schema changes, you'd need to manually run SQL to reverse changes.
For data migrations, implement a `down` function in your custom migration.

## Best Practices

1. **Test migrations locally first** with `wrangler dev`
2. **Use version-prefixed names** for custom migrations: `0001_description`, `0002_description`
3. **Check migration status** after deployment
4. **Keep migrations idempotent** - use `INSERT OR IGNORE`, `CREATE TABLE IF NOT EXISTS`, etc.
5. **Never edit executed migrations** - create a new migration instead

## Troubleshooting

### Tables not appearing

- Check that the table is exported from `ottabase/db/schema.ts`
- Verify the table name ends with `Table` (convention)
- Check `/migration-status` for errors

### Package tables not created

- Verify the package is enabled in `config.migrations.ts`
- Check that the table is imported correctly
- Look for errors in `/migration-status`

### Migrations running multiple times

- Each migration should have a unique name
- Check the `_ottabase_migrations` table for duplicate entries
- Ensure migration names don't change after deployment

## Examples

See the following files for complete examples:

- `ottabase/models/Todo.ts` - Simple app-specific model
- `@ottabase/shortlinks` package - Shortlinks model in package
- `ottabase/migrations/index.ts` - Custom migrations setup
- `ottabase/config.migrations.ts` - Package configuration
