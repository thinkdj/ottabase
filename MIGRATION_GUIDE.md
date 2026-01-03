# OttaORM Automated Migration System

> **Zero-config migrations** - Just define your Models and call `/api/ottaorm/init`. No CLI commands, no manual SQL, no hassle.

## Overview

The OttaORM migration system is now **fully automated**. When you call `/api/ottaorm/init`, it automatically:

1. ✅ Detects all tables from your Models
2. ✅ Creates tables that don't exist
3. ✅ Adds new columns to existing tables
4. ✅ Runs your custom migrations (seeds, indexes, etc.)

## Quick Start

### 1. Define Your Model

```typescript
// ottabase/models/Todo.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { BaseModel } from "@ottabase/ottaorm";

export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;
  static primaryKey = "id";

  // ... your model methods
}
```

### 2. Export in Schema

```typescript
// ottabase/db/schema.ts
export { usersTable, postsTable, tagsTable } from "@ottabase/ottaorm";
export { todosTable } from "../models/Todo";
```

### 3. Call the Init Endpoint

```bash
# Development (no auth)
curl -X POST http://localhost:8790/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer your-secret"
```

**That's it!** No CLI commands needed. The endpoint automatically:
- Creates the `todos` table if it doesn't exist
- Adds any new columns you define later
- Runs any custom migrations

## Developer Experience

### Before (Manual Migrations)

```bash
# Old workflow - lots of manual steps
1. Define your Model
2. Write SQL migration manually
3. Run: drizzle-kit generate
4. Find the diff
5. Copy SQL to migration file
6. Import migration in index.ts
7. Deploy
8. Run migrations on server
```

### After (Automated Migrations)

```bash
# New workflow - one step!
1. Define your Model
2. Call: POST /api/ottaorm/init
   ✅ Done!
```

## Adding New Columns

Just add the column to your table definition:

```typescript
export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false),

  // NEW: Add a priority field
  priority: integer("priority").default(0).notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

Then call `/api/ottaorm/init` again:

```json
{
  "success": true,
  "message": "Successfully applied 1 change(s)",
  "details": {
    "tablesCreated": [],
    "columnsAdded": ["todos.priority"],
    "customMigrationsRun": [],
    "errors": []
  }
}
```

## Custom Migrations

For operations that can't be auto-generated (seeds, indexes, views, triggers), add custom migrations:

### Example: Seed Data

```typescript
// ottabase/migrations/index.ts
export const appMigrations: Migration[] = [
  {
    name: "0000_seed_admin_user",
    up: async (db) => {
      await db.execute(`
        INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
        VALUES (
          'admin-001',
          'Admin User',
          'admin@example.com',
          strftime('%s', 'now') * 1000,
          strftime('%s', 'now') * 1000
        )
      `);
    },
  },
];
```

### Example: Performance Indexes

```typescript
{
  name: "0001_add_performance_indexes",
  up: async (db) => {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_posts_author_published
      ON posts(author_id, published);

      CREATE INDEX IF NOT EXISTS idx_todos_user_completed
      ON todos(user_id, completed);
    `);
  },
}
```

### Example: Database Views

```typescript
{
  name: "0002_create_user_stats_view",
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
}
```

## API Response Format

```typescript
{
  "success": boolean,
  "message": string,
  "details": {
    "tablesCreated": string[],      // e.g., ["todos", "comments"]
    "columnsAdded": string[],       // e.g., ["todos.priority", "users.avatar"]
    "customMigrationsRun": string[], // e.g., ["0000_seed_admin", "0001_indexes"]
    "errors": string[]              // Any errors encountered
  },
  "timestamp": string               // ISO timestamp
}
```

## How It Works Internally

### Runtime Schema Detection

The system uses Drizzle's `getTableConfig()` to introspect your table definitions:

```typescript
import { collectTableSchemas } from '@ottabase/ottaorm';
import * as schema from './db/schema';

// Automatically finds all exports ending with 'Table'
const tables = collectTableSchemas(schema);
// { usersTable, postsTable, todosTable, ... }
```

### Automatic Table Creation

```typescript
// Generates CREATE TABLE SQL from your Drizzle table
const createSQL = generateCreateTableSQL(todosTable);
// CREATE TABLE IF NOT EXISTS todos (
//   id TEXT PRIMARY KEY,
//   title TEXT NOT NULL,
//   ...
// )
```

### Automatic Column Addition

```typescript
// Compares existing DB schema with Model definitions
const existingColumns = await getTableColumns(db, 'todos');
const newColumns = detectNewColumns(todosTable, existingColumns);

// Generates ALTER TABLE statements
for (const column of newColumns) {
  await db.execute(`ALTER TABLE todos ADD COLUMN ${column} ${type}`);
}
```

### Migration Tracking

All migrations (auto and custom) are tracked in `_ottabase_migrations` table:

```sql
CREATE TABLE _ottabase_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER NOT NULL,
  driver_type TEXT DEFAULT 'd1-drizzle'
);
```

## Security

### Development
- No authentication required
- Automatically detected when `env.ENVIRONMENT !== 'production'`

### Production
- Requires `MIGRATION_SECRET` environment variable
- Provide secret via:
  1. Query param: `?secret=your-secret`
  2. POST body: `{ "secret": "your-secret" }`
  3. Header: `Authorization: Bearer your-secret`

```bash
# Example production call
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## SQLite Limitations

### Cannot Add NOT NULL Without DEFAULT

SQLite doesn't allow adding `NOT NULL` columns to existing tables without a `DEFAULT` value:

```typescript
// ❌ Will fail if table already exists
priority: integer("priority").notNull(),

// ✅ Works - has default value
priority: integer("priority").default(0).notNull(),
```

If you need to add a `NOT NULL` column without a default:
1. Add it as nullable first
2. Populate the data
3. Create a new migration to make it NOT NULL (requires table recreation)

### Column Type Changes

SQLite doesn't support `ALTER COLUMN` to change types. To change a column type:
1. Create a new column with the new type
2. Migrate data from old to new column
3. Drop old column
4. Rename new column

## Advanced: Programmatic Usage

You can also use the auto-migration API programmatically:

```typescript
import { autoInit, collectTableSchemas } from '@ottabase/ottaorm';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import * as schema from './db/schema';

const driver = createD1Driver(env.OBCF_D1);
const tables = collectTableSchemas(schema);

const result = await autoInit({
  driver,
  schema: tables,
  customMigrations: [], // Optional
  verbose: true,
});

console.log(result);
// {
//   success: true,
//   message: "Successfully applied 3 change(s)",
//   details: { tablesCreated: [...], columnsAdded: [...] }
// }
```

## Rollback Strategy

Since migrations are applied automatically, rollbacks should be handled carefully:

### For Table/Column Additions
- **Don't rollback** - keep the schema forward-compatible
- Old code will ignore new columns
- New code will use new columns

### For Custom Migrations
- Add a `down` function to your custom migrations
- Use the rollback endpoint (if needed)

```typescript
{
  name: "0000_seed_admin",
  up: async (db) => {
    await db.execute(`INSERT INTO users ...`);
  },
  down: async (db) => {
    await db.execute(`DELETE FROM users WHERE id = 'admin-001'`);
  },
}
```

## Best Practices

### ✅ Do's

- Use descriptive Model names that match table names
- Add DEFAULT values to new NOT NULL columns
- Test migrations in development first
- Use `IF NOT EXISTS` / `OR IGNORE` in custom migrations
- Keep custom migrations small and focused
- Version your schema.ts file in git

### ❌ Don'ts

- Don't rename tables (create new table + migrate data instead)
- Don't change primary key types (requires recreation)
- Don't remove columns (SQLite limitation - requires table recreation)
- Don't modify past migrations (create new ones)
- Don't run migrations manually in production (use the endpoint)

## Troubleshooting

### "Table already exists" error
- This shouldn't happen with `CREATE TABLE IF NOT EXISTS`
- Check if table was created outside OttaORM

### "Cannot add NOT NULL column" error
- Add a DEFAULT value to the column definition
- Or add it as nullable first, then populate data

### "Migration failed" in production
- Check server logs for detailed error
- Verify MIGRATION_SECRET is set correctly
- Ensure D1 database is properly bound

### Schema not updating
- Verify your table is exported in `db/schema.ts`
- Check that you're importing the latest schema
- Try restarting your dev server

## Migration Workflow

### Local Development

```bash
# 1. Define/update your Models
vim ottabase/models/Todo.ts

# 2. Run init endpoint
curl -X POST http://localhost:8790/api/ottaorm/init

# 3. Verify in Drizzle Studio (optional)
pnpm db:studio
```

### Staging/Production

```bash
# 1. Deploy your code (Models included)
pnpm deploy

# 2. Run migrations via endpoint
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"

# 3. Verify
curl https://your-app.com/api/health
```

## Comparison: Auto vs Manual Migrations

| Feature | Auto Migrations | Manual Migrations |
|---------|----------------|-------------------|
| Table creation | ✅ Automatic | ❌ Manual SQL |
| Column addition | ✅ Automatic | ❌ Manual SQL |
| Column removal | ⚠️ Not supported | ✅ Manual (recreation) |
| Type changes | ⚠️ Not supported | ✅ Manual (recreation) |
| Indexes | ➕ Custom migration | ✅ Manual SQL |
| Seeds | ➕ Custom migration | ✅ Manual SQL |
| Views/Triggers | ➕ Custom migration | ✅ Manual SQL |
| CLI required | ✅ No | ❌ Yes |
| DX | ✅ Excellent | ⚠️ Tedious |

## Summary

The automated migration system provides:

- **Zero-config setup** - No CLI commands needed
- **Type-safe** - Leverages your TypeScript Model definitions
- **Flexible** - Supports custom migrations for advanced use cases
- **Safe** - Tracks all migrations, prevents duplicates
- **DX-friendly** - Just define Models and call one endpoint

For 90% of use cases (creating tables, adding columns, seeding data), you'll never need to write SQL migrations manually again!

## Next Steps

- [Define your first Model](./apps/ottabase-template-app/ottabase/models/)
- [Add custom migrations](./apps/ottabase-template-app/ottabase/migrations/custom/)
- [Explore the API](./apps/ottabase-template-app/app/api/ottaorm/)
- [Read Drizzle ORM docs](https://orm.drizzle.team/docs/overview)
