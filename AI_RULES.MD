# AI Rules — Ottabase Framework

Concise rules for AI agents working in this codebase. See `AGENTS.MD` for full detail.

---

## Core Principles

- **OttaORM First** — Models inherit `BaseModel`, own schema + logic. No raw SQL/Drizzle unless performance-critical.
- **Fat Models** — `user.activate()` not `authService.activate(user)`.
- **KISS, DRY** — Simplest solution; reuse before adding new helpers.

---

## Data & Schema

| Action            | Where                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| Model definitions | `apps/*/ottabase/models/`                                                               |
| Drizzle schema    | `apps/*/ottabase/db/schema.ts` — export all tables here                                 |
| Prisma (auth)     | Do not edit `schema.prisma` directly; use `packages/db/prisma/schemas/` + `db:generate` |

**Model contract:** `static entity`, `static table`, `static primaryKey`. Register with `registerModels()` for CRUD API.

---

## Dependencies

| Use           | When                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `workspace:*` | Internal packages (`@ottabase/*`)                                       |
| `catalog:`    | Shared deps (react, drizzle, etc.) — add to `pnpm-workspace.yaml` first |
| Local         | Single package/app only                                                 |
| Peer          | Framework/runtime deps in shared packages                               |

---

## Runtime & Env

- **Cloudflare Workers** — No Node-only APIs (fs, child_process) in app code.
- **Dev OS** — Windows 11; prefer cmd over PowerShell (path issues). (Deployment would be on Linux)
- **Runtime** — Node 24+, pnpm 10+.

---

## Reuse First

- **UI** — `@ottabase/ui-shadcn`, Tremor where applicable. Tailwind + dark mode.
- **State** — `@ottabase/state` (Jotai). No Redux/Context.
- **Auth** — `@ottabase/auth` (Auth.js).
- **Async** — `@ottabase/queue`. No unawaited promises logic.
- **Utils** — `@ottabase/utils` (timezone, string, url, file) before new helpers.
- **Icons** — `@tabler/icons-react` primary; Lucide/Radix fallback.

---

## Commands

```bash
pnpm build:pkg        # Before any package work
pnpm dev              # Vite + Wrangler
curl -X POST .../api/ottaorm/init   # Apply migrations
pnpm lint && pnpm type-check        # Quality
```

---

## Workflow

1. **Before PR** — `pnpm build:pkg && pnpm test --filter=@ottabase/ottaorm`
2. **New features** — Add/modify tests; ensure they pass.
3. **Format** — `pnpm -w prettier:fix` (4 spaces, single quotes, LF).
4. **Docs** — Concise READMEs; no stray SUMMARY.MD or noise.

---

## Anti-Patterns

- Logic in Controllers/Services instead of models
- Circular deps, direct cross-package file imports
- Models without `entity` + `table`
- New CSS files (use Tailwind in components)
- npm/yarn instead of pnpm

## Rules for this repo

- Multi-tenant isolation is critical
- Never mix org data
- Prefer explicit logic
- No hidden magic
- Follow spec exactly
- If unsure, ask instead of guessing
- Type-safe TypeScript only
- Do not invent APIs
