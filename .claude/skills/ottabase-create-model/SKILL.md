---
name: ottabase-create-model
description:
    The Ottabase way to add a data model (OttaORM fat model over D1). Use whenever you need a new database-backed
    entity, table, or model class in an Ottabase app — "add a model", "new table", "create an entity", "store X in the
    DB". Encodes the registration steps an agent otherwise forgets.
---

# Create an OttaORM model

All data models inherit from `BaseModel` (`@ottabase/ottaorm`). Logic lives **on the model** (fat models), never in
controllers/services. Do not write raw SQL or vanilla Drizzle unless there is a measured performance need.

## Steps (all are required — a missing one makes the model invisible to CRUD or migrations)

1. **Define the Drizzle table** in the package (`packages/<pkg>/src/schema.ts`) for a package table, or in the app for
   an app table. Use `sqliteTable` from `drizzle-orm/sqlite-core`.
2. **Write the model class** in `apps/*/ottabase/models/<Name>.ts`:
    - `static entity = '<table>'`, `static table = <table>`, `static primaryKey = 'id'` (all three — a model without
      `entity` + `table` is an anti-pattern).
    - `static casts = { ... }` for boolean/json/date columns.
    - Relationships (`belongsTo`/`hasMany`/`hasOne`/`belongsToMany`) **must use dynamic `import()`** inside the method
      to avoid circular deps.
    - Domain logic as methods: `todo.markDone()`, not `service.markDone(todo)`.
    - `static deferred = [...]` for big columns that should not ride along on list reads (reading a deferred column off
      a collection-loaded record throws — by design).
3. **Export the table** from `apps/*/ottabase/db/schema.ts` (drizzle-kit) **and** add it to `appTables` in
   `apps/*/ottabase/db/schemas-helper.ts` (runtime migrations). Both — they feed different paths.
4. **Register the model** in `apps/*/worker/lib/db-utils.ts` `initDbConnection` (the right array: `appModels` /
   `packageModels` / `brandModels`). Without this, `/api/ottaorm/{entity}` 404s.
5. **Run migrations**: `curl -X POST http://localhost:3004/api/ottaorm/init`. Auto-migration can add tables/columns but
   **cannot rename/drop** — and a new NOT NULL column needs a DEFAULT.

## Gotchas

- Server-created rows must carry the **caller's** `organizationId` from the resolved security context, never from
  request/upload metadata — `platformAdmin` does NOT bypass the tenant filter.
- RLS context (`organizationId`, `userId`, `appId`) is mandatory and comes from a verified session, never request
  headers.
- Menu/MenuItem are the exception — they use `/api/brand/menus`, not OttaORM.

## Authoritative sources

`AGENTS.MD` → "OttaORM: Fat Model System", "Deferred Columns", "Schema Collection", "Model Registry", "File Locations".
Package README: `packages/ottaorm/README.md`. Full docs: `/llms-full.txt`.
