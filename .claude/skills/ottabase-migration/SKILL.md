---
name: ottabase-migration
description:
    The Ottabase way to evolve the database schema — auto-migrations from Models plus custom migrations for what auto
    can't do. Use for "add a column", "migrate the DB", "schema change", "seed data", "add an index/view/trigger",
    "rename a column". Encodes what auto-migration can and cannot do, and where custom migrations live.
---

# Migrations the Ottabase way

Tables come from your **Models** — you rarely hand-write DDL. `POST /api/ottaorm/init` runs `autoInit` (engine in
`@ottabase/ottaorm`), which collects every schema via `getAllSchemas()` and applies it to D1. In prod it requires
`MIGRATION_SECRET` (`checkMigrationAuth`); it's also callable from Admin › Migrations and on tenant bootstrap.

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## What auto-migration can / cannot do

- **Can**: create missing tables, add new columns, ensure declared indexes, run tracked custom migrations. History lives
  in `_ottabase_migrations`; results report `tablesCreated` / `columnsAdded` / `indexesEnsured` / `customMigrationsRun`.
- **A new NOT NULL column needs a DEFAULT** (otherwise it can't backfill existing rows).
- **Cannot** rename or drop by default — that needs `allowDestructive: true` (`MIGRATION_ALLOW_DESTRUCTIVE` or request
  body) and/or a `renameMap`. **No automatic rollback** — reversing a schema change is manual.

## Custom migrations (for what Models can't express)

Reserve these for **seeding, indexes, views, triggers, data backfills** — not for creating tables (Models do that). They
live in the app registry `apps/*/ottabase/migrations/` (combined by `buildAppMigrations(env)`), each an object:

```ts
{
    name: '0001_seed_admin_user',
    up: async (db) => {
        await db.executeRaw(`INSERT OR IGNORE INTO users (...) VALUES (...)`);
    },
    // down?: async (db) => { ... }   // optional, only for reversible data migrations
}
```

Names are ordered; each runs once and is recorded. In this greenfield/pre-launch repo you can also just **edit the
Model/schema directly and re-run init** rather than writing a migration — there is no production data to preserve yet.

## Gotchas

- The engine is `@ottabase/ottaorm/src/migrations` (`autoInit` / runtime generator). There is **no active
  `@ottabase/migrate` package on main** — don't import from it.
- After `clean:d1` / `clean:state`, re-run bootstrap + init to rebuild the schema.
- A new NOT NULL column without a DEFAULT will fail the migration — add one.

## Authoritative sources

`AGENTS.MD` → "Auto-Migrations", "Schema Collection (3 Sources)". `packages/ottaorm/README.md` (migration engine +
`Migration` shape), `apps/otta-web/ottabase/migrations/index.ts`, `apps/otta-web/worker/routes/ottaorm-init.ts`. Full
docs: `/llms-full.txt`.
