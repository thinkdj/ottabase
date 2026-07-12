# @ottabase/ottaorm — agent notes

Drizzle-based fat-model ORM for D1/SQLite: models, CRUD, RLS, auto-migrations, TanStack hooks. Full docs: ./README.md

## Use when

- Defining data models (BaseModel subclasses), CRUD/API handlers, row-level security, auto table migrations, or client-side TanStack Query hooks over models.
- NOT for raw DB connection/driver setup (that's `@ottabase/db`) or non-model one-off SQL.

## Imports

```ts
import { BaseModel, registerConnection, registerModels, registerPolicy, initRLS, parseCrudRequest, executeSecureCrudRequest, autoInit, collectTableSchemas, runAutoMigrations, buildZodSchema, ValidationError, RLSError } from '@ottabase/ottaorm';
import { User, Organization, Role, Session, Media, usersTable, type UserType, type NewUserType } from '@ottabase/ottaorm/models';
import { AbstractBaseModel, type ModelFields, type PaginationResult } from '@ottabase/ottaorm/base';
import { createModelHooks, useApiQuery, useApiMutation, useEntityQuery, OttaQueryProvider, createQueryClient } from '@ottabase/ottaorm/client';
```

## Canonical usage

Fat model (table in `Todo.schema.ts`, model re-exports it):

```ts
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { todosTable } from './Todo.schema';

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';
    static casts = { completed: 'boolean' as const };
    protected static fields: ModelFields = { /* per-field type/validation/uiConfig */ };
}
```

Worker CRUD route (RLS-enforced; adapted from otta-web `worker/routes/ottaorm-crud.ts`):

```ts
registerConnection('default', createD1Driver(env.OBCF_D1));
const crudRequest = await parseCrudRequest(request, url, '/api/ottaorm');
if (!crudRequest) return errorResponse('Invalid CRUD request', 400);
const result = await executeSecureCrudRequest(crudRequest, securityContext);
```

Client hooks:

```ts
const { useList, useDetail, useCreate, useUpdate, useDelete, useInfiniteList } =
    createModelHooks<TodoType>({ entityName: 'todos' });
```

## Wiring (new app model)

1. Table schema in `apps/<app>/ottabase/models/X.schema.ts`; fat model class in `X.ts` re-exporting the table.
2. Export the table from `apps/<app>/ottabase/db/schema.ts` (package tables go via `PACKAGE_REGISTRY` in `apps/<app>/ottabase/config.migrations.ts`).
3. Add the model class to `registerModels([...])` in `apps/<app>/worker/lib/db-utils.ts`; register any custom policy with `registerPolicy(...)` before `initRLS()`.
4. Auto-migrations pick tables up via `collectTableSchemas` / `autoInit` — no hand-written migration needed for new tables.

## Gotchas

- Root and `/base` entrypoints are Edge-safe by design; `MongoBaseModel` exists in `src/base` but is intentionally NOT exported (mongodb is Node-only). `mongodb`, `react`, `@tanstack/react-query` are optional peer deps.
- RLS context is mandatory: build a `SecurityContext` (organizationId/userId/appId) and use `executeSecureCrudRequest`/`secureCrud` — never raw `handleCrud` for user-facing routes.
- CRUD list queries cap `limit` at 1000 and `offset` at 100_000 (`src/crud/index.ts`).
- `registerConnection('default', driver)` must run per-request/isolate before any model call; drivers come from `@ottabase/db` (e.g. `createD1Driver`).
- API failures: `errorResponse(...)` from `@ottabase/utils/http-errors`; sanitize user HTML/URLs via `@ottabase/utils/sanitize`.
