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
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { BaseModel } from "@ottabase/ottaorm";

export const projectsTable = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export class Project extends BaseModel {
  static entity = "projects";
  static table = projectsTable;
  static primaryKey = "id";
}
```

### 2. Export in Schema

```typescript
// ottabase/db/schema.ts
export { usersTable, postsTable } from "@ottabase/ottaorm";  // Core
export { todosTable } from "../models/Todo";                  // App
export { projectsTable } from "../models/Project";            // NEW!
```

### 3. Initialize Database

```bash
# Development (no auth)
curl -X POST http://localhost:8790/api/ottaorm/init

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
export const projectsTable = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").default("active").notNull(), // NEW FIELD!
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

```bash
curl -X POST http://localhost:8790/api/ottaorm/init
# ✅ Column added automatically!
```

## Custom Migrations

For seeds, indexes, or views, add custom migrations:

```typescript
// ottabase/migrations/index.ts
import type { Migration } from "@ottabase/ottaorm";

export const appMigrations: Migration[] = [
  {
    name: "0000_seed_admin_user",
    up: async (db) => {
      await db.execute(`
        INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
        VALUES ('admin-001', 'Admin', 'admin@example.com',
                strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
      `);
    },
  },
  {
    name: "0001_add_indexes",
    up: async (db) => {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_projects_status
        ON projects(status)
      `);
    },
  },
];
```

See [custom/README.md](./custom/README.md) for examples.

## Schema Structure

The schema combines **core tables** (from `@ottabase/ottaorm`) + **app tables**:

```typescript
// ottabase/db/schema.ts

// CORE TABLES (from @ottabase/ottaorm)
export {
  usersTable,
  accountsTable,
  sessionsTable,
  postsTable,
  tagsTable,
} from "@ottabase/ottaorm";

// APP-SPECIFIC TABLES
export { todosTable } from "../models/Todo";
export { projectsTable } from "../models/Project";
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

## Documentation

See the [Migration Guide](../../../../MIGRATION_GUIDE.md) for complete details.
