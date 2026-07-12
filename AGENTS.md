# Ottabase — Agent Instructions

Monorepo: pnpm workspaces + Turborepo. Vite/React apps deployed to Cloudflare Workers (D1, KV, R2,
Queues, Durable Objects). TypeScript only.

**Token-minimal doc protocol:** this file is the map — keep it loaded. Before working inside any
`packages/<pkg>/` or `apps/<app>/`, read that directory's `AGENTS.md` (≤70 lines: verified imports,
canonical usage, wiring, gotchas). Follow pointers to `docs/agents/` runbooks only when the task
needs them. Do not bulk-read READMEs.

## Hard rules (always apply)

1. **OttaORM first**: data models inherit `BaseModel`; no raw SQL or vanilla Drizzle unless truly
   necessary. **Fat models**: business logic lives in model methods (`user.activate()`), never in
   controllers/services or page handlers.
2. **Edge runtime**: no Node-only APIs (fs, child_process) in app/worker code.
3. **Multi-tenant isolation + RLS are mandatory**: always provide context (`organizationId`,
   `userId`, `appId`); never bypass RLS.
4. **Deps**: internal `workspace:*`, shared external `catalog:`, pnpm only (never npm/yarn). Full
   rules: `docs/agents/dependencies.md`.
5. **Sanitize untrusted content**: user/editor HTML, URLs, JSON-in-script, and CSS-in-style go
   through `@ottabase/utils/sanitize` (`sanitizeInlineHtml`, `sanitizeBlockHtml`, `sanitizeSvgHtml`,
   `sanitizeUrl`, `sanitizeJsonForScript`, `sanitizeCssForStyleTag`). No raw
   `dangerouslySetInnerHTML`.
6. **API failures** use `errorResponse(message, status)` from `@ottabase/utils/http-errors`.
7. **Don't reinvent**: check `@ottabase/utils` (helpers) and `@ottabase/ui-shadcn` (components)
   first. UI: minimal design (GitHub/Notion feel), Tailwind classes over new CSS files, design
   tokens over hardcoded colors, always add dark-mode classes. Icons: Lucide, then Tabler/Radix.
8. **Cloudflare binding parity**: when bindings change, keep `wrangler.jsonc` and
   `cloudflare-env.d.ts` in sync.
9. **Relationship safety**: dynamic imports inside `BaseModel` relationship methods (avoids
   circular deps).
10. **Docs + tests are mandatory** for every meaningful change (update the package `README.md`).
    Never create stray summary files (e.g. `SUMMARY.MD`). Don't delete existing docs/comments
    unless verified wrong.
11. **Scoped commands**: `pnpm build:pkg --filter=<pkg>`, `pnpm test --filter=<pkg>`. Full
    builds/dev servers are for cloud agents or the local user only (`docs/agents/environment.md`).
12. **KISS + DRY, explicit over magic; ask when architecture is unclear.** No git
    commit/reset/rebase without explicit user instruction.

## Decision tree

**New app feature** → standard entity CRUD? Use model + `createModelHooks()` +
`/api/ottaorm/{entity}` — no custom CRUD endpoints without a real non-CRUD need (exception:
Menu/MenuItem use `/api/brand/menus`). Worker routes orchestrate/auth/validate only; persistence
behavior lives in the model.

**New package** → decide persistence first. Stateless: keep framework-agnostic. Persistent: package
exports the table schema, app owns the model + all wiring — follow
`docs/agents/add-package-with-model.md` (6 steps: schema → PACKAGE_REGISTRY → model →
registerModels → export table + hooks → `POST /api/ottaorm/init`).

**Session/profile mutations** → read `docs/agents/auth-sessions.md` first (JWT + KV snapshot model;
skipping the profile-version bump makes writes invisible for ~30 days).

```typescript
// CRUD hooks (client)
import { createModelHooks } from '@ottabase/ottaorm/client';
export const { useList, useCreate, useUpdate, useDelete } = createModelHooks({ entityName: 'todos' });

// Fat model (server)
export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    async markDone() {
        this.set('completed', true);
        return this.save();
    }
}
```

## Package index

One line each — details in `packages/<pkg>/AGENTS.md`. `DB` = exports a table schema (needs wiring
per the add-package runbook).

### Data & platform core

| Package        | Use for                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| `ottaorm` DB   | The ORM: define models, CRUD, RLS, auto-migrations, query hooks                       |
| `db`           | Database drivers (D1/Drizzle, MongoDB) + feature schema registry                      |
| `auth`         | Full auth stack (sessions, OAuth, magic links) for Workers apps                       |
| `rbac`         | Roles/permission checks, org-scoped, KV-cached; middleware + admin guards             |
| `cf`           | Cloudflare binding clients: D1/KV/R2/Images/Queues/rate-limit/kv-cache                |
| `cf-ai`        | Multi-provider AI inference client (CF Gateway/Workers AI, fallback, streaming)       |
| `cf-realtime`  | WebSocket pub/sub (Pusher alternative) on Cloudflare Durable Objects                  |
| `queue`        | Cloudflare Queues job dispatch/processing: registries, dedupe, priorities, chaining   |
| `cron`         | Workers scheduled-event cron: static jobs or DB-driven scheduler                      |
| `ottarouter`   | Cloudflare Workers HTTP router; routing/middleware, not data or queues                |
| `api`          | Typed fetch client: auth, retries, dedupe, ApiError; frontend HTTP calls              |
| `config`       | App config factory + env-override resolution; defaults for theme/auth/pagination      |
| `state`        | Jotai app-state factory: theme/user/sidebar atoms + provider                          |
| `logger`       | Leveled logger with pluggable transports/formatters, all runtimes                     |
| `utils`        | String/file/timezone/currency/sanitize/pagination helpers — check before writing new  |

### Features

| Package             | Use for                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `ottablog` DB       | Blog/CMS models, theming, and BlogRenderer for posts/changelogs/docs           |
| `brand-engine` DB   | Design tokens, theme presets, CSS vars, brand-kit persistence + API            |
| `brand-engine-react`| React BrandProvider/useBrand/LayoutResolver bindings for brand-engine theming  |
| `comments` DB       | Threaded comments on any entity: reactions, moderation, replies                |
| `notifications` DB  | Send user/admin notifications via email, WebSocket, or queue                   |
| `referrals` DB      | Referral attribution: click/conversion tracking model + username validation    |
| `shortlinks` DB     | URL shortlinks on D1: redirect handler, interstitial/expired pages             |
| `analytics`         | Cloudflare Analytics Engine: event tracking, WAE SQL queries, funnels          |
| `audit`             | Audit-trail logging: who did what, plus Next.js/Worker middleware              |
| `email`             | Email templating + sending (Resend/SES/MailChannels/SMTP/dev-trap)             |
| `i18n`              | Translations: I18nProvider, useTranslation, language detection                 |
| `medialibrary`      | Media helpers + React lightbox/preview UI (schema lives in ottaorm)            |
| `ottaupload`        | File upload UI + R2/CF-Images server helpers; use for any upload flow          |
| `forms`             | React CRUD UI auto-generated from OttaORM model metadata                       |
| `docs`              | React Markdown docs-site viewer (sidebar, TOC, themes)                         |
| `homepage-contract` | Zod payload contracts for homepage/page/nav JSON; not theming                  |

### UI

| Package             | Use for                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `ui-shadcn`         | shadcn/ui component library + theme provider — the default for app UI          |
| `ui-components`     | ConfirmDialog, JsonEditor, DarkModeToggle, MessageBox, Logo, pagination        |
| `ui-datatable`      | React data table (TanStack v8): list views, server sort/pagination             |
| `ui-tailwind`       | Tailwind preset + base CSS wiring shadcn theme tokens to utilities             |
| `ui-base`           | Base CSS reset/animations + ProviderUIBase root wrapper                        |
| `ui-mantine`        | Mantine provider + theme presets, for Mantine-based app shells                 |
| `ui-code-highlight` | CodeBlock: syntax highlighting, copy button, line numbers                      |
| `ui-cropper`        | Vanilla DOM image cropper (crop/flip/rotate/zoom, Blob export)                 |
| `ui-split-pane`     | Resizable split-pane layout (vertical/horizontal, snap points)                 |
| `ottaeditor`        | Rich-text block editor (EditorJS + custom blocks) for React UIs                |
| `ottarenderer`      | Render saved Editor.js/HTML content as React (read-side of ottaeditor)         |
| `ottaselect`        | Dropdown/select (single/multi, async search)                                   |
| `ottamenu`          | Menu renderers (sidebar/mega/navbar/footer) + menu tree types                  |
| `ottalayout`        | Layout configs, presets, path-to-layout resolver, React slots                  |
| `ottadate`          | Vanilla-JS date/range/datetime/fuzzy pickers; UTC unix values                  |
| `spotlight`         | Command palette (Cmd+K style) with debounced async search                      |

### Tooling & templates

| Package       | Use for                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `cli`         | `otta` dev CLI: scaffold/build/test monorepo apps (not runtime code)       |
| `scripts`     | Dev CLI bins (cf:\*, db:\*, clean:\*); never imported as a library         |
| `hello-world` | Template/demo package — the reference structure for new packages           |

**Apps:** `otta-web` (React + TanStack + Workers template/showcase — copy patterns, don't import),
`otta-landing` (Next.js marketing site, slot-based homepage sections). Each has its own `AGENTS.md`.

## File locations

| Purpose           | Location                                            |
| ----------------- | --------------------------------------------------- |
| Models            | `apps/*/ottabase/models/`                           |
| Schema            | `apps/*/ottabase/db/schema.ts`                      |
| Schema collection | `apps/*/ottabase/db/schemas-helper.ts`              |
| Package registry  | `apps/*/ottabase/config.migrations.ts`              |
| Model registry    | `apps/*/worker/lib/db-utils.ts` (initDbConnection)  |
| Custom routes     | `apps/*/ottabase/config.routes.ts`                  |
| App config        | `apps/*/ottabase/ottabase.config.ts`                |
| Client hooks      | `apps/*/src/ottabase/hooks/` or `apps/*/src/hooks/` |
| Migrations        | `apps/*/ottabase/migrations/`                       |
| API routes        | `apps/*/worker/routes/router.ts`                    |
| Pages             | `apps/*/src/pages/`                                 |

## Commands

```bash
pnpm build:pkg --filter=<pkg>    # build one package (agents: always --filter)
pnpm test --filter=<pkg>         # test one package
pnpm lint && pnpm type-check     # quality gates (ottalayout has a known lint failure)
pnpm format                      # prettier (4 spaces, single quotes, LF)
otta new web my-app              # scaffold app; also: otta dev/build/test/lint/list/info
curl -X POST http://localhost:3004/api/ottaorm/init   # apply auto-migrations
```

Dev servers, first-run bootstrap (`/__bootstrap__`), and cloud-agent setup:
`docs/agents/environment.md`.

## Anti-patterns

Circular package deps · direct file imports across package boundaries · framework-specific code in
generic packages · models without `static entity`/`static table` · OttaORM for Menu/MenuItem ·
business logic in routes/controllers · npm/yarn · package-specific lock files · implicit deps ·
hardcoded one-off colors · `window.location.reload()` after session mutations.

## Deep runbooks (load on demand)

- `docs/agents/add-package-with-model.md` — persistence wiring end-to-end, schema collection,
  auto-migration capabilities, fat-model reference
- `docs/agents/auth-sessions.md` — session JWT/KV model, profile-mutation methodology
- `docs/agents/dependencies.md` — catalog/workspace/peer rules, adding deps
- `docs/agents/environment.md` — env setup, dev servers, bootstrap, CI/PR checklist

## Maintainers

@thinkdj — architecture questions & exceptions. Escalation: issue with `architecture` label.
