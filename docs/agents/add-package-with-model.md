# Adding a Package with a Model — Agent Runbook

> The canonical end-to-end path for any package that persists data via OttaORM. Quick decision tree
> lives in the root `AGENTS.md`.

## Persistence decision first

- **No DB persistence:** keep the package framework-agnostic and stateless where possible. Stop here.
- **Needs DB persistence:** follow the split below. The PACKAGE exports the table schema; the APP
  owns the `BaseModel` class and all wiring.

## The 6 steps

### 1. Package: export schema

```typescript
// packages/mypackage/src/schema.ts (or src/persistence for complex packages)
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable('mytable', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});
```

### 2. App: register in config.migrations.ts

Add to `PACKAGE_REGISTRY` in `apps/*/ottabase/config.migrations.ts` (tables + optional migrations),
and add the package key to `ottabase.config.ts` `packages` (built-in) or `customPackages` (custom).
For custom packages, also register route handlers in `ottabase/config.routes.ts`.

### 3. App: create model

```typescript
// apps/my-app/ottabase/models/MyModel.ts
import { BaseModel } from '@ottabase/ottaorm';
import { myTable } from '@ottabase/mypackage/schema';

export class MyModel extends BaseModel {
    static entity = 'mytable';
    static table = myTable;
    static primaryKey = 'id';
}
```

### 4. App: register model in db-utils.ts

Add `MyModel` to the appropriate array (packageModels, brandModels, appModels) in
`apps/*/worker/lib/db-utils.ts` `initDbConnection`:

```typescript
registerModels([...coreModels, ...ottablogModels, ...packageModels, ...brandModels, ...appModels]);
```

Only registered models get the generic CRUD API: `GET /api/ottaorm/mytable`, `POST ...`, etc.

### 5. App: export table and create hooks

```typescript
// ottabase/db/schema.ts
export { myTable } from '@ottabase/mypackage/schema';

// ottabase/hooks/useMyModel.ts
import { createModelHooks } from '@ottabase/ottaorm/client';
export const {
    useList,
    useDetail,
    useFind, // Find by field/value (e.g., slug, email)
    useCreate,
    useUpdate,
    useDelete,
    useInfiniteList,
} = createModelHooks({ entityName: 'mytable' });
```

App-native tables (not from a package) also go in `ottabase/db/schemas-helper.ts` `appTables`.

### 6. Run migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Schema collection (3 sources)

`getAllSchemas()` in `ottabase/db/schemas-helper.ts` combines tables for auto-migrations:

1. **CORE** — from `@ottabase/ottaorm` (users, auth tables, etc.)
2. **APP** — app-specific tables (add to `schemas-helper.ts` `appTables`)
3. **PACKAGES** — from `getEnabledPackageTables()` in `config.migrations.ts`

Package tables are driven by `ottabase.config.ts` `packages` and `customPackages`. **brandEngine is
core** — always enabled, not in `ottabase.config` packages. `schema.ts` exports feed drizzle-kit
(`db:push`, `db:studio`); `schemas-helper.ts` feeds runtime migrations (`api/ottaorm/init`).

## Auto-migration capabilities

`POST /api/ottaorm/init` (also called from tenant bootstrap and Admin > Migrations):

- Creates new tables; adds columns to existing tables
- New NOT NULL columns need DEFAULT values
- Cannot rename/drop columns (use a custom migration in `apps/*/ottabase/migrations/`)

## Fat-model reference

```typescript
import { BaseModel } from '@ottabase/ottaorm';

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

    static casts = {
        completed: 'boolean' as const,
    };

    async user() {
        // Dynamic imports inside relationship methods avoid circular dependencies
        const { User } = await import('@ottabase/ottaorm');
        return this.belongsTo(User, 'userId');
    }

    async toggle() {
        this.set('completed', !this.get('completed'));
        return this.save();
    }
}
```

Models support: Drizzle table schema, type casting, field metadata (UI config, validation),
relationships (`belongsTo`, `hasMany`, `hasOne`, `belongsToMany`), and custom methods. RLS
(`tenant`, `user`, `app` rules) is enforced at the ottaorm level — `initRLS()` must run during app
initialization; never bypass RLS without explicit architecture approval.

## Known exception

Menu and MenuItem do NOT use OttaORM CRUD — they use `/api/brand/menus` (cache-invalidating CRUD).
