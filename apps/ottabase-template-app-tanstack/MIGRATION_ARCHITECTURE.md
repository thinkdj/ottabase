# Migration System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTS                                  │
│                                                                          │
│  Visit: http://127.0.0.1:3004/migration-status                         │
│     OR: curl -X POST http://127.0.0.1:3004/api/ottaorm/init            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             cloudflare-worker.ts: /api/ottaorm/init                     │
│                                                                          │
│  • Checks authentication (MIGRATION_SECRET in prod)                     │
│  • Calls getAllSchemas() to collect all table definitions               │
│  • Calls autoInit() with schemas + custom migrations                    │
│  • Returns detailed migration results                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  ottabase/db/schemas-helper   │   │  ottabase/migrations/index    │
│                               │   │                               │
│  getAllSchemas():             │   │  appMigrations:               │
│  ├─ Core tables               │   │  ├─ Core migrations           │
│  │  (users, posts, auth, etc)│   │  ├─ App migrations            │
│  ├─ App tables                │   │  └─ Package migrations        │
│  │  (todos, custom tables)   │   │                               │
│  └─ Package tables            │   │  From: config.migrations.ts   │
│     (shortlinks, etc)         │   │                               │
│                               │   │                               │
│  From: ottabase/db/schema.ts  │   │                               │
│     + config.migrations.ts    │   │                               │
└───────────────────────────────┘   └───────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  @ottabase/ottaorm: autoInit()                          │
│                                                                          │
│  1. Get existing tables from database                                   │
│  2. For each table in schemas:                                          │
│     ├─ If table doesn't exist → CREATE TABLE                            │
│     └─ If table exists → Check for new columns → ALTER TABLE            │
│  3. For each custom migration:                                          │
│     ├─ Check _ottabase_migrations table                                 │
│     ├─ If not run → Execute migration                                   │
│     └─ Record in _ottabase_migrations                                   │
│  4. Return detailed results                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare D1 Database                           │
│                                                                          │
│  Tables:                                                                 │
│  ├─ _ottabase_migrations (migration tracking)                           │
│  ├─ users (core)                                                        │
│  ├─ sessions (core)                                                     │
│  ├─ accounts (core)                                                     │
│  ├─ posts (core)                                                        │
│  ├─ todos (app-specific)                                                │
│  └─ shortlinks (package)                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              src/pages/MigrationStatusPage.tsx                           │
│                                                                          │
│  Displays:                                                               │
│  ✅ Migration Summary                                                   │
│     • Tables detected: 8                                                │
│     • Tables created: 3                                                 │
│     • Tables skipped: 5                                                 │
│     • Columns added: 0                                                  │
│     • Migrations run: 0                                                 │
│                                                                          │
│  📊 Tables Detected (Schema)                                            │
│  🆕 Tables Created                                                       │
│  ⏭️ Tables Skipped (Existing)                                           │
│  ➕ Columns Added                                                        │
│  ⚡ Migrations Run                                                       │
│  ⏭️ Migrations Skipped                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│              ottabase/config.migrations.ts                               │
│                                                                          │
│  PACKAGE_REGISTRY = {                                                    │
│    shortlinks: {                                                        │
│      tables: { shortlinksTable },                                       │
│      migrations: [],                                                    │
│    },                                                                   │
│  }                                                                      │
│                                                                          │
│  migrationConfig = {                                                    │
│    shortlinks: true,  ← Enable/disable packages here                   │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
      getEnabledPackageTables()       getEnabledPackageMigrations()
                    │                               │
                    ▼                               ▼
      Used by schemas-helper.ts      Used by migrations/index.ts
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                        Passed to autoInit()
```

## Schema Organization

```
Core Schemas (@ottabase/ottaorm)
├─ usersTable
├─ sessionsTable
├─ accountsTable
├─ authenticatorsTable
├─ verificationTokensTable
├─ postsTable
├─ postTagsTable
└─ tagsTable

App-Specific Schemas (ottabase/models/*)
└─ todosTable

Package Schemas (from enabled packages)
└─ shortlinksTable (when enabled in config.migrations.ts)

ALL COMBINED IN: getAllSchemas()
```

## Migration Execution Order

```
1. Table Creation/Updates (Automatic)
   ├─ Core tables
   ├─ App tables
   └─ Package tables

2. Custom Migrations (In Order)
   ├─ Core migrations (empty by default)
   ├─ App-specific migrations (your custom ones)
   └─ Package migrations (from enabled packages)
```

## Data Flow

```
Developer adds new table:
1. Create Model in ottabase/models/NewModel.ts
2. Export table from ottabase/db/schema.ts
3. Call /api/ottaorm/init
4. Table automatically created ✅

Developer adds new package:
1. Import package tables in config.migrations.ts
2. Add to PACKAGE_REGISTRY
3. Set to true in migrationConfig
4. Call /api/ottaorm/init
5. Package tables automatically created ✅

Developer adds custom migration:
1. Add to migrations/index.ts
2. Call /api/ottaorm/init
3. Migration runs once, tracked in _ottabase_migrations ✅
```
