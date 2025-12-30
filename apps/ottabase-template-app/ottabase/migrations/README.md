# Database Migrations

This directory contains TypeScript-based migrations following Drizzle's **codebase first approach**.

## Architecture

Ottabase uses a **programmatic migration system** that combines:

1. **Core migrations** from `@ottabase/ottaorm` (users, accounts, posts, tags, sessions, etc.)
2. **App-specific migrations** defined in this directory (`ottabase/migrations/index.ts`)

All migrations are defined in TypeScript and executed at runtime via the D1 driver.

## Adding New Migrations

Edit `ottabase/migrations/index.ts` to add new migrations:

```typescript
import type { Migration } from "@ottabase/ottaorm";

export const appMigrations: Migration[] = [
  // Existing migrations...
  {
    name: '001_create_todos_table',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS todos (...)
      `);
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS todos`);
    }
  },
  // Add new migrations here:
  {
    name: '002_add_priority_to_todos',
    up: async (db) => {
      await db.execute(`
        ALTER TABLE todos ADD COLUMN priority INTEGER DEFAULT 0
      `);
    },
    down: async (db) => {
      // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
      // For simplicity, this example leaves down() empty
    }
  }
];
```

## Running Migrations

### Development (Local D1)

```bash
# Start the dev server first
pnpm dev

# Then run migrations (in another terminal)
pnpm db:migrate
```

Or visit the migration endpoint directly:
- **Next.js app**: `http://localhost:3000/api/ottaorm/init`
- **TanStack app**: `http://localhost:8790/api/ottaorm/init`

### Production

Migrations require `MIGRATION_SECRET` authentication in production:

```bash
# Via curl
curl -X POST https://your-app.pages.dev/api/ottaorm/init \
  -H "Authorization: Bearer YOUR_MIGRATION_SECRET"

# Or via query parameter
curl -X POST "https://your-app.pages.dev/api/ottaorm/init?secret=YOUR_MIGRATION_SECRET"
```

## How It Works

1. **Core models** are automatically created from `@ottabase/ottaorm`:
   - `users`, `accounts`, `sessions`, `verification_tokens`, `authenticators`
   - `posts`, `tags`, `post_tags`

2. **App-specific models** are created from your `appMigrations`:
   - Add tables, indexes, and schema changes here

3. **Migration tracking** uses the `_ottabase_migrations` table to prevent re-running migrations

## Benefits of This Approach

- ✅ **No SQL files to manage** - Everything in TypeScript
- ✅ **Type-safe migrations** - Full IDE support and type checking
- ✅ **Automatic core schema** - Core models provided by `@ottabase/ottaorm`
- ✅ **Feature-based organization** - Add features via config
- ✅ **Runtime execution** - No build step required for migrations
- ✅ **Cloudflare D1 native** - Works with Drizzle ORM and D1 driver

## Related Files

- `ottabase/migrations/index.ts` - App-specific migrations
- `ottabase/models/*.ts` - Drizzle table definitions (for ORM queries)
- `@ottabase/ottaorm` - Core migrations and ORM utilities
- `db.config.ts` - Database configuration (features, provider)
