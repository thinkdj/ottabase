# @ottabase/migrate

Unified migration system for Ottabase with Drizzle ORM and Cloudflare D1 support.

## Features

- ✅ **Drizzle-First**: Generate SQL from Drizzle table definitions using drizzle-kit
- ✅ **Config-Based**: Models registered in `db.config.ts` with feature grouping
- ✅ **Interactive CLI**: Beautiful command-line interface with confirmations
- ✅ **State Tracking**: Unified `_migrations` table tracks all migrations
- ✅ **D1 Support**: First-class Cloudflare D1 support with wrangler integration
- ✅ **Rollback**: Safe rollback capabilities with confirmation prompts
- ✅ **Lock Management**: Prevents concurrent migrations

## Installation

```bash
pnpm add @ottabase/migrate
```

## Quick Start

### 1. Configure Migrations in `db.config.ts`

```typescript
import { defineAppDbConfig } from "@ottabase/db/drizzle";
import { defineMigrateConfig } from "@ottabase/migrate/config";

export default defineAppDbConfig({
  appId: "my-app",
  dbProvider: "d1",
  d1Database: "DB",
  wranglerConfig: "wrangler.jsonc",

  migrations: defineMigrateConfig({
    models: [
      // Core models from packages
      {
        import: "@ottabase/ottaorm/models",
        models: ["User", "Post", "Tag"],
        feature: "core",
      },
      // Auth models
      {
        import: "@ottabase/ottaorm/models",
        models: ["Account", "Session"],
        feature: "auth",
      },
      // App-specific models
      {
        path: "./ottabase/models",
        models: ["Organization", "Workspace"],
        feature: "app",
      },
    ],
    migrationsPath: "ottabase/migrations",
  }),
});
```

### 2. Initialize Migration System

```bash
pnpm migrate init
```

### 3. Create a Migration

```bash
# Interactive wizard
pnpm migrate create

# Or with flags
pnpm migrate create --name add_organizations --feature app
```

### 4. Check Status

```bash
pnpm migrate status

# Filter by feature
pnpm migrate status --feature auth
```

### 5. Apply Migrations

```bash
# Apply all pending migrations (interactive prompt for local/remote)
pnpm migrate up

# Apply to remote D1
pnpm migrate up --remote

# Apply specific number
pnpm migrate up --steps 2

# Dry run (preview only)
pnpm migrate up --dry-run
```

### 6. Rollback Migrations

```bash
# Rollback last migration
pnpm migrate down

# Rollback multiple
pnpm migrate down --steps 3

# Dry run
pnpm migrate down --dry-run
```

## CLI Commands

```bash
migrate init              # Initialize migration system
migrate status            # Show migration status
migrate create            # Create new migration
migrate up                # Apply pending migrations
migrate down              # Rollback migrations
migrate reset --force     # Reset database (rollback all)
```

## Migration File Format

Generated migration files are TypeScript with `up()` and `down()` methods:

```typescript
// ottabase/migrations/1704835200000_create_organizations.ts

export interface MigrationDatabase {
  run(sql: string): Promise<void>;
  exec(sql: string): Promise<void>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

export default {
  name: "1704835200000_create_organizations",
  feature: "app",

  async up(db: MigrationDatabase): Promise<void> {
    await db.exec(`
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  },

  async down(db: MigrationDatabase): Promise<void> {
    await db.run('DROP TABLE IF EXISTS organizations');
  }
};
```

## Programmatic Usage

```typescript
import { MigrationManager, createD1Executor, getMigrateConfig } from '@ottabase/migrate';

const config = await getMigrateConfig();
const executor = createD1Executor('DB', false); // false = local
const manager = new MigrationManager(executor, config);

// Initialize
await manager.initialize();

// Create migration
await manager.createMigration({
  name: 'add_feature',
  feature: 'app',
});

// Apply migrations
await manager.up({ steps: 1 });

// Get status
const status = await manager.getStatus();
console.log(`Pending: ${status.pending.length}`);
console.log(`Applied: ${status.applied.length}`);

// Rollback
await manager.down({ steps: 1 });
```

## Model Requirements

Models must follow the OttaORM pattern:

```typescript
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { BaseModel } from "@ottabase/ottaorm";

export const organizationsTable = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export class Organization extends BaseModel {
  static entity = "organizations";    // Required: table name
  static table = organizationsTable;  // Required: Drizzle schema
}
```

## License

MIT
