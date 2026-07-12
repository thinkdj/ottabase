# @ottabase/otta-web — agent notes

Template app: React + TanStack + Cloudflare Workers showcase wiring every Ottabase package; copy patterns, don't import. Full docs: ./README.md

## Use when

- Scaffolding a new Ottabase app, or looking up canonical wiring for any package (auth, brand-engine, ottaorm, ottablog, shortlinks, referrals, ...). Live examples under `/demo/*` routes (src/router.tsx).
- NOT as a dependency: `private: true`, no exports map — never `import` from it.

## Canonical usage

App-specific fat model (ottabase/models/Todo.ts):

```ts
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { todosTable } from './Todo.schema';

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';
}
```

Create all tables (zero-config migrations):

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
# prod: -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Wiring

Adding a package with tables:

1. Register tables + migrations in PACKAGE_REGISTRY — `ottabase/config.migrations.ts`. Entries are gated by `config.packages[...]`: built-ins are preconfigured; custom packages also need `customPackages` in ottabase.config.ts and routes in config.routes.ts. PACKAGE_REGISTRY is for packages only — never add app models here (they'd be silently filtered out).
2. Define the model in `ottabase/models/` (BaseModel subclass, see above).
3. Add it to the models array passed to `registerModels(...)` in `worker/lib/db-utils.ts`.
4. Re-export the table from `ottabase/db/schema.ts` (e.g. `export { todosTable } from '../models/Todo';`) — consumed by drizzle-kit (`db:push`) only, not by init.

Adding an app-specific model (like Todo): skip step 1; instead add the table to `appTables` inside `getAllSchemas()` (and `getSchemaSummary()`) in `ottabase/db/schemas-helper.ts` — that's what `/api/ottaorm/init` passes to `autoInit`, so without it the table is never created. Then do steps 2-4.

## Gotchas

- SSOT is `ottabase/ottabase.config.ts`; never edit `ottabase/config.loader.ts` (derived).
- Tables are created only via `POST /api/ottaorm/init` (Bearer MIGRATION_SECRET in prod) — no drizzle-kit migrations at deploy time.
- wrangler.jsonc uses a two-tier placeholder system: ALL_CAPS_SNAKE_CASE values in `env.production`/`env.preview` are substituted by CI from GitHub Secrets — don't hardcode real IDs.
- Edge runtime only (Workers): no Node-only APIs. RLS context (organizationId/userId/appId) is mandatory; DB/model/RLS setup is cached per isolate in the worker.
- Deps follow house rules: `workspace:*` for internal packages, `catalog:` for shared externals.
- Dev ports: Vite on 3003, worker on 3004 (`pnpm dev` vs `pnpm dev:worker`).
