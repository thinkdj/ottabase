# Automated Migrations

OttaORM now supports **fully automated migrations** - no CLI commands, no manual SQL!

## How It Works

1. **Define Models** with Drizzle table schemas
2. **Export in schema.ts** (combines core + app tables)
3. **Call `/api/ottaorm/init`** → Tables created automatically ✅

## Quick Start

### 1. Define Your Model

```typescript
// ottabase/models/Project.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { BaseModel } from '@ottabase/ottaorm';

export const projectsTable = sqliteTable('projects', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export class Project extends BaseModel {
    static entity = 'projects';
    static table = projectsTable;
    static primaryKey = 'id';
}
```

### 2. Export in Schema

```typescript
// ottabase/db/schema.ts
export { usersTable, postsTable } from '@ottabase/ottaorm'; // Core
export { todosTable } from '../models/Todo'; // App
export { projectsTable } from '../models/Project'; // NEW!
```

### 3. Initialize Database

```bash
# Development (no auth)
curl -X POST http://localhost:3000/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

**Response:**

```json
{
    "success": true,
    "message": "Successfully applied 1 change(s)",
    "details": {
        "tablesCreated": ["projects"],
        "columnsAdded": [],
        "customMigrationsRun": []
    }
}
```

## Adding New Fields

Just add the field and re-run `/api/ottaorm/init`:

```typescript
export const projectsTable = sqliteTable('projects', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status').default('active').notNull(), // NEW FIELD!
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
});
```

```bash
curl -X POST http://localhost:3000/api/ottaorm/init
# ✅ Column added automatically!
```

## Custom Migrations

For seeds, indexes, views, or complex operations, add custom migrations:

```typescript
// ottabase/migrations/index.ts
import type { Migration } from '@ottabase/ottaorm';

export const appMigrations: Migration[] = [
    {
        name: '0000_seed_admin_user',
        up: async (db) => {
            await db.execute(`
        INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
        VALUES ('admin-001', 'Admin', 'admin@example.com',
                strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
      `);
        },
    },
    {
        name: '0001_add_indexes',
        up: async (db) => {
            await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_posts_author_published
        ON posts(author_id, published);

        CREATE INDEX IF NOT EXISTS idx_todos_user_completed
        ON todos(user_id, completed);
      `);
        },
    },
    {
        name: '0002_create_user_stats_view',
        up: async (db) => {
            await db.execute(`
        CREATE VIEW IF NOT EXISTS user_stats AS
        SELECT
          u.id,
          u.name,
          COUNT(p.id) as post_count,
          COUNT(t.id) as todo_count
        FROM users u
        LEFT JOIN posts p ON p.author_id = u.id
        LEFT JOIN todos t ON t.user_id = u.id
        GROUP BY u.id
      `);
        },
    },
];
```

### Best Practices

- ✅ Use descriptive names: `0000_seed_data` not `migration1`
- ✅ Use `IF NOT EXISTS` / `OR IGNORE` for idempotency
- ✅ Keep migrations small and focused
- ✅ Test in development first
- ⚠️ Don't modify past migrations (create new ones)
- ⚠️ Be careful with data migrations in production

## Limitations

SQLite's `ALTER TABLE` has restrictions. The automated system **cannot**:

- ❌ **Change column types** - Use custom migration to recreate table
- ❌ **Rename columns** - Use custom migration to recreate table
- ❌ **Drop columns** - Use custom migration to recreate table
- ❌ **Modify constraints** - Use custom migration to recreate table
- ⚠️ **Add NOT NULL columns** - Must have `DEFAULT` value or use custom migration

**Example: Adding NOT NULL column**

```typescript
// ✅ GOOD - Has default value
status: text('status').default('active').notNull();

// ❌ BAD - No default, will fail if table has data
status: text('status').notNull();
```

## Troubleshooting

### Migration fails with "NOT NULL constraint"

**Problem**: Added NOT NULL column without DEFAULT to table with existing data.

**Solution**: Add a DEFAULT value or use custom migration:

```typescript
{
  name: "0003_add_status_column",
  up: async (db) => {
    await db.execute(`ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active' NOT NULL`);
  },
}
```

### Need to rename/change column type

**Problem**: Automated migrations can't change column types or rename columns.

**Solution**: Create custom migration to recreate table:

```typescript
{
  name: "0004_recreate_users_table",
  up: async (db) => {
    // 1. Create new table
    await db.execute(`CREATE TABLE users_new (...)`);
    // 2. Copy data
    await db.execute(`INSERT INTO users_new SELECT ... FROM users`);
    // 3. Drop old table
    await db.execute(`DROP TABLE users`);
    // 4. Rename new table
    await db.execute(`ALTER TABLE users_new RENAME TO users`);
  },
}
```

## Schema Structure

The schema combines **core tables** (from `@ottabase/ottaorm`) + **app tables**:

```typescript
// ottabase/db/schema.ts

// CORE TABLES (from @ottabase/ottaorm)
export { usersTable, accountsTable, sessionsTable, postsTable, tagsTable } from '@ottabase/ottaorm';

// APP-SPECIFIC TABLES
export { todosTable } from '../models/Todo';
export { projectsTable } from '../models/Project';
```

## Alternative: Manual Push (Advanced)

For advanced use cases, you can still use `drizzle-kit push`:

```bash
# Push schema to remote D1
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

This requires setting these environment variables:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_D1_DATABASE_ID=your-database-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## Benefits

- ✅ **Zero-config** - No CLI commands needed
- ✅ **Type-safe** - TypeScript schema = source of truth
- ✅ **Auto-detection** - Creates tables & adds columns automatically
- ✅ **Custom migrations** - For seeds, indexes, views
- ✅ **Per-app** - Each app has its own schema
- ✅ **Production-ready** - Secure with MIGRATION_SECRET
