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
