---
name: ottabase-crud
description:
    The Ottabase way to build CRUD for an entity — generic OttaORM route + client hooks + the ModelCrud UI. Use for
    "list/create/edit/delete X", "admin table for X", "CRUD screen", "wire up the API for this model". Stops agents from
    hand-rolling custom endpoints and bespoke fetch code.
---

# CRUD the Ottabase way

Standard entity CRUD is **almost no code**: a fat model drives a generic API route, generated hooks, and a drop-in UI.
Do not introduce custom CRUD endpoints unless there is a real non-CRUD need.

## Backend

1. The model (see `ottabase-create-model`) must be registered in `worker/lib/db-utils.ts`. That alone exposes
   `GET/POST/PATCH/DELETE /api/ottaorm/{entity}` via the single secure route (`executeSecureCrudRequest`), tenant-scoped
   by RLS.
2. If the route uses an allowlist (`GENERIC_CRUD_ALLOWLIST`), add the entity name to it.
3. Keep persistence logic in model methods; the worker route only orchestrates/auths/validates.

## Client

4. **Never call `fetch()`** in client code (lint-banned). Generate hooks once:
    ```ts
    import { createModelHooks } from '@ottabase/ottaorm/client';
    export const { useList, useDetail, useFind, useCreate, useUpdate, useDelete, useInfiniteList } =
        createModelHooks<TodoType>({ entityName: 'todos' });
    ```
    Reads → a query hook; writes → a mutation hook. Retry/backoff/dedup are framework-owned — do not add them.

## UI (90% case)

5. For an admin surface, use the forms package instead of building a table:
    ```tsx
    import { createModelConfig } from '@ottabase/forms';
    import { ModelCrud } from '@ottabase/forms/react';
    const config = createModelConfig(Todo); // metadata comes from the model (single source of truth)
    // <ModelCrud config={config} />  → list + detail + create/edit/delete + delete-confirm
    ```
    Field UI/validation come from the model's field metadata — define it once on the model, not in the form.

## Gotchas

- A write must use the caller's `organizationId` from the security context; never trust an `x-org-id` / `x-app-id`
  header.
- API failures return `errorResponse(...)` from `@ottabase/utils/http-errors` (lint-enforced); 5xx bodies never carry
  exception text.
- Menu/MenuItem use `/api/brand/menus`, not OttaORM.

## Authoritative sources

`AGENTS.MD` → "High-Impact Nuances › If adding a new app feature", "Client Data Layer", "Client Hooks".
`packages/forms/README.md`, `packages/ui-datatable/README.md`. Full docs: `/llms-full.txt`.
