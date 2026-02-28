# AI Rules — Ottabase Framework

> [!IMPORTANT] **This is your "Always-On" ruleset.** Read these rules first. However, if you are working on a massive
> task involving deep debugging, scaffolding new architecture, or creating a new package/model, you MUST read
> `AGENTS.MD` for context on Row-Level Security, Database schema collection, and architecture wiring.

---

## Core Principles

- **OttaORM First** — Models inherit `BaseModel`; own schema + logic. No raw SQL/Drizzle unless performance-critical.
- **Fat Models** — `user.activate()` not `authService.activate(user)`.
- **KISS, DRY** — Simplest solutions; reuse before adding new code.
- **Type Safety** — TypeScript only;
- **Create/Edit README.MD and Tests** - whenever you make changes to the codebase, update the appropriate README.MD and
  tests accordingly.

---

## Data & Schema

| Action            | Location                                                |
| ----------------- | ------------------------------------------------------- |
| Model definitions | `apps/*/ottabase/models/`                               |
| Drizzle schema    | `apps/*/ottabase/db/schema.ts` — export all tables      |
| Schema collection | `apps/*/ottabase/db/schemas-helper.ts` — app tables     |
| Package tables    | `apps/*/ottabase/config.migrations.ts` PACKAGE_REGISTRY |
| Model registry    | `apps/*/worker/lib/db-utils.ts` — initDbConnection      |
| Custom routes     | `apps/*/ottabase/config.routes.ts`                      |

**Model contract:** `static entity`, `static table`, `static primaryKey`. Add to db-utils.ts for `/api/ottaorm/{entity}`
CRUD.

**CRUD:** Prefer `createModelHooks()` + `/api/ottaorm/{entity}`. Exception: Menu/MenuItem → `/api/brand/menus` (not
OttaORM).

**brandEngine** — Core package, always enabled; not in `ottabase.config.ts` packages.

---

## New Package with Persistence

1. Package exports schema (`src/schema.ts` or `src/persistence`).
2. Add to `config.migrations.ts` PACKAGE_REGISTRY.
3. Add to `ottabase.config.ts` `packages` or `customPackages`; custom → also `config.routes.ts`.
4. App: model in `ottabase/models/`, add to `db-utils.ts`, export table in `schema.ts`; app tables in
   `schemas-helper.ts`.
5. Migrations: `curl -X POST .../api/ottaorm/init`.

---

## Dependencies

| Use           | When                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `workspace:*` | Internal (`@ottabase/*`)                                             |
| `catalog:`    | Shared (react, drizzle) — add to `pnpm-workspace.yaml` catalog first |
| Local         | Single package/app only                                              |
| Peer          | Framework deps in shared packages                                    |

---

## Runtime & Env

- **Cloudflare Workers** — No Node-only APIs (fs, child_process) in app/worker code.
- **Windows 11** — Prefer cmd; avoid PowerShell (path issues).
- **Deployment (CI/CD)** - would run on Ubuntu.
- **Node 24+**, pnpm, Turborepo.

---

## Reuse First

| Area   | Use before adding new                                               |
| ------ | ------------------------------------------------------------------- |
| UI     | `@ottabase/ui-shadcn`, `@ottabase/ui-mantine`; Tailwind + dark mode |
| Charts | Tremor where applicable                                             |
| Icons  | `@tabler/icons-react`; Lucide/Radix fallback                        |
| State  | `@ottabase/state` (Jotai)                                           |
| Auth   | `@ottabase/auth` (Auth.js)                                          |
| Async  | `@ottabase/queue`                                                   |
| Utils  | `@ottabase/utils` (timezone, string, url, file)                     |

---

## Commands

```bash
pnpm build:pkg                              # Before package work
pnpm dev                                    # Vite + Wrangler
curl -X POST .../api/ottaorm/init            # Apply migrations
pnpm lint && pnpm type-check                 # Quality
pnpm format                                 # Prettier (4 spaces, single quotes, LF)
```

**Agents:** Run builds/tests with `--filter=<package>` only; no full `pnpm build` or `pnpm dev` unless cloud agent.

---

## Workflow

1. **Before PR** — `pnpm build:pkg && pnpm test --filter=@ottabase/ottaorm`
2. **New code** — Add/update tests; ensure they pass.
3. **Format** — `pnpm format`; check `.prettierrc`.
4. **Docs** — Concise READMEs; no SUMMARY.MD or noise. Copy-paste ready snippets.

---

## Anti-Patterns

- Logic in Controllers/Services instead of models
- Circular deps; direct cross-package file imports
- Models without `static entity` + `static table`
- New CSS files (use Tailwind in components)
- npm/yarn instead of pnpm
- OttaORM for Menu/MenuItem (use `/api/brand/menus`)

---

## Repo Rules

- Multi-tenant isolation is critical; never mix org data.
- **Row-Level Security (RLS)** is enforced via `globalRLS.register()`. Agents must not bypass RLS and must provide
  proper context (`organizationId`, `userId`, `appId`) for data operations.
- Prefer explicit logic; no hidden magic.
- Type-safe TypeScript only; do not invent APIs.
- When creating relationships in `BaseModel`, avoid circular dependencies by using dynamic imports within methods (e.g.
  `const { User } = await import('@ottabase/ottaorm');`).
- When modifying Cloudflare bindings, ensure `wrangler.jsonc` and `cloudflare-env.d.ts` are kept strictly in sync.
- Use `errorResponse` from `@ottabase/utils/http-errors` instead of standard `new Response()` for API error responses.
- If unsure, ask instead of guessing.
