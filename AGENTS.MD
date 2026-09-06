<INSTRUCTIONS>
# Agents & Architecture

## What is Ottabase?

Ottabase is a Cloudflare-native foundation for shipping production SaaS, Apps, and content sites without first
assembling the infrastructure. It exists because the interesting part of a product is never the auth flow, the tenant
boundary, or the media library - yet those are what burn the maker. Everything a real app needs is already wired
together here: in-house auth, RBAC, an ORM over D1, forms, uploads, a robust blog/CMS, queues, realtime, RLS, and a
powerful runtime theming engine (Brand Engine), across 50+ packages that already know about each other. The maker can
focus on the product, not the plumbing and get their ideas out over a weekend. For real.

The typical Ottabase user is a solo founder or a small team who wants to open the repo and start on the actual product.

Monorepo using **pnpm workspaces** + **Turborepo**. Vite app with Cloudflare Workers deployment.

## AI Guidelines (MUST FOLLOW)

1. **OttaORM First**: All data models MUST inherit from `BaseModel`. Do not write raw SQL or vanilla Drizzle queries
   unless absolutely necessary for performance. Logic belongs in the Model class, not in "Controllers" or "Services".
2. **Schema Integrity**: Drizzle schema lives in `apps/*/ottabase/db/schema.ts`. Export all tables there. Package tables
   come from package schemas (e.g. `@ottabase/shortlinks/schema`) and are wired via `config.migrations.ts`
   PACKAGE_REGISTRY and `schemas-helper.ts`. The app uses Drizzle + OttaORM over Cloudflare D1 — the only ORM/backend
   (Prisma and MongoDB were removed).
3. **Workspace Protocol**: Always use `workspace:*` for internal package dependencies. Use `catalog:` for shared
   external dependencies (React, Drizzle, etc.).
4. **Don't Reinvent**: Check `@ottabase/utils` for internal helpers (date, string, currency) and `@ottabase/ui-shadcn`
   for UI components before creating new ones.
5. **Edge Runtime**: This is a Cloudflare Workers project. Avoid Node.js-only APIs (fs, child_process) in app code.
6. **Fat Models**: Encapsulate logic in models. E.g., `user.activate()` instead of `authService.activate(user)`.
7. **Sanitize Untrusted Content**: For user/editor-provided HTML or URL values, always use `sanitizeInlineHtml`,
   `sanitizeBlockHtml`, `sanitizeSvgHtml`, and `sanitizeUrl` from `@ottabase/utils/sanitize`. For inline JSON script
   content (for example `application/ld+json`), use `sanitizeJsonForScript`. For CSS injected into `<style>` tags, use
   `sanitizeCssForStyleTag`. All `dangerouslySetInnerHTML` payloads must be passed through the appropriate sanitizer
   helper first. Do not use raw `dangerouslySetInnerHTML` or raw `href` values without sanitization.

## Always-On Rules

- **Explicit over magic**: prefer clear, auditable logic and avoid hidden side effects.
- **Multi-tenant isolation is critical**: never mix organization data across tenants.
- **RLS context is mandatory**: always provide adequate context (`organizationId`, `userId`, `appId`) and never bypass
  RLS behavior.
- **Controller/service anti-pattern**: keep business logic in models, not controllers/services.
- **Relationship safety**: use dynamic imports inside `BaseModel` relationship methods to avoid circular dependencies.
- **Cloudflare binding parity**: when bindings change, keep `wrangler.jsonc` and `cloudflare-env.d.ts` in sync.
- **Error response consistency**: for API failures, use `errorResponse(...)` from `@ottabase/utils/http-errors`
  (lint-enforced — see "Enforced by Lint").
- **Every app declares its dev ports in `package.json#ottabase.start`**: that block is the single source of truth for
  dev URLs/ports. `otta start` launches from it and `pnpm dev:kill` (`--app=<name>`) frees ports from it. Never keep a
  parallel port list anywhere else; an app without the block cannot be started or cleaned up by the tooling. Format:
  see `packages/cli/README.md` "App lifecycle contract".
- **Every workspace defines `lint`, `type-check`, `test`, and `build`**: `turbo` silently skips a task a package does
  not declare, so a missing script is indistinguishable from a passing one. A new app or package without these is
  invisible to CI. **One carve-out:** a package whose `exports` point at `./src` (`ottablog`, `ottaai`, `medialibrary`,
  `comments`, `shortlinks`) has no build output, so it defines `lint`/`type-check`/`test` and deliberately NO `build`.
  Adding one there emits a `dist/` nothing imports — and for any package with module-level singletons that dist becomes
  a SECOND copy of the registry, which is a silent correctness bug, not just waste. Its source is still compiled (and
  therefore CI-covered) by the app build.
- **Docs + tests are mandatory**: update README/docs and tests for every meaningful code change.
- **No noise docs**: do not create stray summary files (for example, `SUMMARY.MD`).
- **KISS + DRY by default**: prefer the simplest maintainable implementation and reuse existing repo primitives.
- **Type-safe only**: use TypeScript; do not invent APIs or rely on implicit behavior.
- **Ask when uncertain**: if architecture or behavior is unclear, ask rather than guessing.

## Enforced by Lint (do not work around)

`eslint.config.mjs` at the repo root is the single config for every workspace; ESLint finds it by walking up from each
package. These rules exist because the prose above was not enough on its own — `errorResponse(...)` was an Always-On
Rule for months while hand-rolled JSON error responses kept shipping.

| Rule                                 | What it blocks                                 | Do this instead                                                          |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `no-restricted-globals` (client)     | raw `fetch()` in `apps/*/src/**`               | `useApiQuery` / `createModelHooks` / `useApiMutation` / `useApiClient()` |
| `no-restricted-imports` (client)     | `createApiClient` outside `src/lib/api.ts`     | build the client once, pass it to `OttaQueryProvider`                    |
| `no-restricted-syntax` (server)      | `new Response(JSON.stringify(...))`            | `errorResponse(...)` / `jsonResponse(...)` from `@ottabase/utils`        |
| `no-restricted-syntax` (server)      | `process.env` in edge code                     | read the env binding via `getOttabaseConfig(env)`                        |
| `ottabase/no-raw-error-log` (server) | `console.error(error)` with a raw thrown value | `redactErrorForLog(error)` from `@ottabase/utils/http-errors`            |
| `react-hooks/rules-of-hooks`         | hooks called after an early return             | call every hook unconditionally, branch in the returned JSX              |

Rules of engagement:

- **Never add a package-local `eslint.config.*`.** It shadows the root config and silently opts the package out of every
  invariant above. Rules live in one file on purpose.
- **Never silence one of these with an inline `eslint-disable`.** If a rule looks wrong for your case, that is a
  discussion, not a directive to suppress.
- The `RATCHET` block at the bottom of `eslint.config.mjs` lists pre-existing violations. It may **shrink, never grow**
  — adding a new file to it is a visible config diff and must be justified in review. New code does not belong there.

## High-Impact Nuances (Agent Checklist)

Use this as the default decision tree when shipping new work.

### If adding a new app feature

1. **CRUD-first via OttaORM**
    - If it is standard entity CRUD, use model + `createModelHooks()` + `/api/ottaorm/{entity}`.
    - Do not introduce custom CRUD endpoints unless there is a real non-CRUD need.
    - Exception: Menu, MenuItem use `/api/brand/menus` (cache-invalidating CRUD), not OttaORM.
2. **Keep data logic in models**
    - Put domain logic in model methods, not page/component handlers.
3. **Theme-safe UI**
    - Prefer design tokens/CSS variables and existing UI packages (`@ottabase/ui-shadcn`, `@ottabase/ui-tailwind`).
    - Avoid hardcoded one-off colors/sizes that bypass theme runtime.
    - Icons: Lucide Icons, and Tabler, Radix as fallback. Charts: Tremor where applicable.
    - Always add dark mode classes for new UI.
4. **Cloudflare edge-safe code**
    - Avoid Node-only APIs in app/worker code.
    - If modifying Cloudflare bindings, you MUST maintain sync between `wrangler.jsonc` and `cloudflare-env.d.ts`.
5. **Minimal route logic & Error Handling**
    - Worker routes should orchestrate/auth/validate; model should own persistence behavior.
    - Return API failures using `errorResponse(...)` from `@ottabase/utils/http-errors` instead of standard responses.
    - 5xx bodies must not carry exception text; log a redacted structured event instead. See "Error & Logging
      Boundaries".
6. **Fetch through the framework client, never `fetch()`**
    - Reads: `useApiQuery` / `createModelHooks` / `useEntityQuery`. Writes: `useApiMutation` or a model mutation hook.
    - Do not add retry, backoff, or request deduplication yourself — the cache owns all three. See "Client Data Layer".
7. **Docs + tests are required**
    - Every new feature must create/update its respective `README.MD` and include/update tests.

### If adding a new package

1. **Persistence decision first**
    - No DB persistence: keep package framework-agnostic and stateless where possible.
    - Needs DB persistence: follow OttaORM split below.
2. **OttaORM persistence split (required)**
    - Package exports table schema (`packages/<pkg>/src/schema.ts` or `packages/<pkg>/src/persistence` for complex
      packages).
    - Add tables to `ottabase/config.migrations.ts` PACKAGE_REGISTRY (tables + optional migrations).
    - Add package key to `ottabase.config.ts` `packages` (built-in) or `customPackages` (custom).
    - For custom packages: also register routes in `ottabase/config.routes.ts`.
    - App owns the `BaseModel` class (`apps/*/ottabase/models/*`).
    - Add model to `worker/lib/db-utils.ts` initDbConnection (registerModels array).
    - App exports table from `apps/*/ottabase/db/schema.ts`; app tables also go in `ottabase/db/schemas-helper.ts`.
3. **Headless and rendered entrypoints (required when both exist)**
    - Keep the root entrypoint (`@ottabase/<pkg>`) headless: export types, pure utilities, models, schemas, and hooks
      that do not render UI.
    - Place rendered React components and helpers that create React nodes behind an explicit subpath such as
      `@ottabase/<pkg>/react` (or a domain-specific name such as `/renderer`).
    - Define each entrypoint in `package.json` `exports`, build and emit declarations for each distributable entrypoint,
      and move UI-only dependencies to optional peers where appropriate.
    - Update every first-party import, README/example, demo snippet, test alias, and TypeScript path mapping when
      introducing or changing a subpath.
    - Add boundary tests that assert the root does not export rendered UI and the rendered subpath exposes it.
4. **Dependency protocol**
    - Internal deps: `workspace:*`
    - Shared external deps: `catalog:`
5. **Wire it into the gates**
    - Declare `lint`, `type-check`, `test`, and `build` scripts. Turbo skips undeclared tasks without reporting
      anything, so a package missing them is not covered by CI at all.
    - Use `"lint": "eslint src"`. Do NOT add a package-local `eslint.config.*` — it shadows the root config and drops
      every framework invariant. Do NOT pass `--ext` (removed in ESLint 9 flat config).
6. **Docs + tests are required**
    - Every new package must create/update its own `README.MD` and include/update tests.

### If adding a Premium Package

Paid add-ons use `@ottabase/premium` and deliberately bypass the free-package wiring above.

1. **One server registration point.** Add the manifest to `apps/*/ottabase/config.premium.ts` (`PREMIUM_PACKAGES`). Its
   runtime tables, migrations, models, routes, nav and gates are derived from there. Do NOT add it to
   `config.migrations.ts` PACKAGE_REGISTRY, `config.routes.ts`, `ottabase.config.ts`, or `db-utils.ts` — those are for
   free packages. Drizzle-kit requires each table as a static export in `ottabase/db/schema.ts`; rendered admin pages
   also need the explicit client adapter in `src/ottabase/config/premium.ts`. Keep those two unavoidable build-time
   adapters covered by the premium-registration test.
2. **Manifest, not integration code.**
   `definePremiumPackage({ key, name, version, licensePublicKey, tables, models, routes, nav, features, freeFeatures, freeLimits, lifecycle })`.
3. **Licensing is offline.** ECDSA P-256 tokens verified with Web Crypto; a license may come from
   `PREMIUM_LICENSE_<KEY>`, the `PREMIUM_LICENSES` map, or the admin UI (in that precedence). `PREMIUM_PKG_<KEY>=false`
   is the kill switch. A package with no `licensePublicKey` is free by construction.
4. **Enforce on the server, hint in the browser.** `requirePremium*` guards answer 402; `<PremiumGate>` and
   `usePremiumFeature` only decide what to render, and fail closed while loading.
5. **Register a paid page's ROUTE on installed, never on licensed.** An unlicensed page renders its upsell; a route that
   disappears gives a bookmarked link a 404 and no way to reach the screen that fixes it.
6. **Never drop a package's tables on uninstall.** Removing it from `PREMIUM_PACKAGES` removes routes and nav only.

Full guide: `docs/PREMIUM_PACKAGES.md`. Worked example: `packages/premium-webhooks`.

### Quick examples

```typescript
// App feature CRUD hooks (preferred for basic CRUD)
import { createModelHooks } from '@ottabase/ottaorm/client';
export const { useList, useCreate, useUpdate, useDelete } = createModelHooks({ entityName: 'todos' });
```

```typescript
// Fat model method (preferred over route/controller business logic)
export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    async markDone() {
        this.set('completed', true);
        return this.save();
    }
}
```

## Structure

```text
ottabase/
├── apps/
│   └── otta-web/  # Primary app (Vite + Workers)
└── packages/      # Shared code
```

## Local Development

- **OS**: Windows 11
- **Terminal**: Command Prompt (cmd) - avoid PowerShell due to path issues
- **Deployment (CI/CD)**: Linux / Ubuntu
- **Runtime**: Node.js 24+
- **Package Manager**: pnpm with workspaces
- **Build**: Turborepo
- Do not apply any git commands that modify state or history (e.g., `git commit`, `git reset`, `git rebase`,
  `git commit --amend`) without explicit user instructions.

```bash
pnpm build:pkg    # Build packages first
pnpm dev          # Vite + Wrangler dev
```

## Core Concepts

### OttaORM: Fat Model System

**Central to the codebase.** All data models inherit from `BaseModel`. Each model is self-contained with:

- Drizzle table schema
- Type casting
- Field metadata (UI config, validation)
- Relationships (belongsTo, hasMany, hasOne, belongsToMany)
- Custom methods

```typescript
import { BaseModel } from '@ottabase/ottaorm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const todosTable = sqliteTable('todos', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false),
    userId: text('user_id'),
});

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

    static casts = {
        completed: 'boolean' as const,
    };

    async user() {
        // Use dynamic imports to avoid circular dependencies for model relationships
        const { User } = await import('@ottabase/ottaorm');
        return this.belongsTo(User, 'userId');
    }

    async toggle() {
        this.set('completed', !this.get('completed'));
        return this.save();
    }
}
```

### Deferred Columns

A model's biggest columns should not ride along on every list read. Name them in `static deferred`
and `where`/`whereIn`/`all`/`search`/`searchPaginate`/`paginate` drop them from the SELECT, while
`find`/`first` still load everything.

```typescript
export class Post extends BaseModel {
    static deferred = ['content', 'footnotes', 'privateNotes'];
}
```

- **Reading a deferred column off a collection-loaded record throws.** That is the point: silence
  turns `if (!post.get('content'))` into a no-op and read-then-write into data loss. Use
  `find`/`first`, or `{ withDeferred: true }`, when a collection read genuinely needs the field.
- **Check the UI before deferring.** If any screen reads the column out of a *list* response it
  cannot be deferred — `PostVersion.content` stays loaded because version restore/compare read it
  from the version list.
- **Not a privacy control.** Single-record reads still load and serialize it. Privacy is `hidden`,
  or a strip in the route's own serializer.

### Row-Level Security (RLS)

- **RLS Engine Enforcement**: RLS acts at the `ottaorm` level to automatically enforce context-based rules.
- **Rules (`tenant`, `user`, `app`)**: Prevent accidental cross-visibility queries. E.g., tenant rules require a
  matching `organizationId`.
- **Pre-requisite**: An `initRLS()` must be executed during app initialization. Never bypass RLS rules without explicit
  architecture approvals.

### Security Context: what may be trusted

The `SecurityContext` handed to RLS decides which rows exist for a caller. Getting its provenance wrong is a tenant
leak, not a bug report.

- **Derive it server-side from a verified session.** OttaORM deliberately has no header-to-context helper; a previous
  `extractSecurityContext(request)` was removed because request headers are trivially spoofable by any client.
- **`appId` comes from server configuration** (`getOttabaseConfig(env)`), never from a browser `x-app-id` header. The
  same applies to ownership fields on uploads and any other row-scoping column — take them from the resolved context,
  never from request/upload metadata.
- **`x-org-id` is a request, not an answer.** Validate it against authoritative active membership before it becomes the
  RLS organization; drop it to `null` if the membership list does not contain it.
- **Fail closed, never open.** If membership cannot be resolved, return `503 SECURITY_CONTEXT_UNAVAILABLE`. An unknown
  membership list must never be treated as "no restrictions" — that silently disables enforcement. Caches (KV) are an
  optimization only: a cache miss, malformed value, or failed write must never change the authorization outcome.

### Error & Logging Boundaries

- **5xx responses are opaque.** `errorResponse()` strips messages, details, hints, field errors, and metadata for any
  status >= 500 and returns a stable `code` plus `requestId`. Only pass `exposure: 'public'` for a message deliberately
  written as public API copy — never for an exception message.
- **Authorization denials say nothing.** Unauthenticated → generic 401, authenticated → generic 403. Never return policy
  text, security context, attempted request data, or the model registry.
- **Redact before logging.** Wrap any thrown value in `redactErrorForLog()`; raw errors carry tokens, cookies, and
  request bodies into log sinks. Prefer one bounded structured JSON event over free-text logging.
- **Provisioning is transactional and fail-closed.** An account without its organization, active membership, and scoped
  role grant is not a successful signup: roll back and surface the failure rather than issuing a session for a
  half-provisioned account.

### Schema Collection (3 Sources)

Tables are collected from 3 sources for auto-migrations. `getAllSchemas()` in `ottabase/db/schemas-helper.ts` combines:

1. **CORE** — from @ottabase/ottaorm (users, auth tables, etc.)
2. **APP** — app-specific tables (add to schemas-helper.ts appTables)
3. **PACKAGES** — from `getEnabledPackageTables()` in config.migrations.ts

Package tables are driven by `ottabase.config.ts` `packages` and `customPackages`. **brandEngine is core** — always
enabled, not in ottabase.config packages. `schema.ts` exports for drizzle-kit (db:push, db:studio); schemas-helper feeds
runtime migrations (api/ottaorm/init).

### Model Registry (for CRUD API)

Models must be registered in `worker/lib/db-utils.ts` initDbConnection for `/api/ottaorm/{entity}` to work:

```typescript
// worker/lib/db-utils.ts
registerModels([...coreModels, ...ottablogModels, ...packageModels, ...brandModels, ...appModels]);
```

When adding a new model, add it to the appropriate array (packageModels, brandModels, appModels) in that file. Then
generic CRUD works: `GET /api/ottaorm/todos`, `POST /api/ottaorm/shortlinks`, etc.

### Auto-Migrations

Tables created/updated automatically:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

This can also be called from the bootstrap process for new tenants and from Admin > Migrations. It runs
`getAllSchemas()` to collect tables from core/app/packages, then applies them to D1.

**Capabilities:**

- Create new tables
- Add columns to existing tables
- New NOT NULL columns need DEFAULT values
- Cannot rename/drop columns (use custom migration)

### Client Hooks

TanStack Query hooks generated from models:

```typescript
// ottabase/hooks/useTodo.ts
import { createModelHooks } from '@ottabase/ottaorm/client';

export const {
    useList: useTodos,
    useDetail: useTodo,
    useFind: useTodoBySlug, // Find by field/value (e.g., slug, email)
    useCreate: useCreateTodo,
    useUpdate: useUpdateTodo,
    useDelete: useDeleteTodo,
    useInfiniteList: useTodosInfinite,
} = createModelHooks<TodoType>({ entityName: 'todos' });

// Usage:
// const { data: todo } = useTodoBySlug("slug", "my-todo-slug");
```

### Client Data Layer (mandatory rules)

There is exactly **one** request path in the browser. It is not optional, and it is not a style preference — it is the
boundary that keeps one tenant's cached rows from being read by another.

1. **One client, built once.** `createApiClient()` is called in `apps/*/src/lib/api.ts` and passed to
   `OttaQueryProvider`. A second client gets its own auth/tenant headers and sits outside the scope boundary.
2. **`OttaQueryProvider` requires a `visibilityScope`** (`appId`, `organizationId`, `principalId`,
   `authorizationVersion`). Each distinct scope gets its own `QueryClient`; when the scope changes, in-flight queries
   are cancelled and the old cache is destroyed before it can be observed. Never pass a pre-built `QueryClient` — the
   provider does not accept one, precisely so cache ownership stays unambiguous.
3. **The transport does one HTTP attempt.** It does not retry and does not coalesce. Retry/backoff belongs to TanStack
   Query and is framework-owned (`retry`, `retryDelay`, and the `refetchOn*` options are `Omit`ted from hook option
   types — if you are reaching for them, you are working against the design).
4. **Reads go through a query hook. Writes go through a mutation hook.** For an imperative read inside React, go through
   the cache (`queryClient.fetchQuery`), not the transport — that is what preserves dedup and caching.
5. **Never retry a mutation.** Repeat protection for writes is a server-side idempotency key, never a client retry.
6. **Errors are presented once, at the query boundary.** The provider's `errorReporter` fires for terminal failures. Use
   `meta: { errorPresentation: 'local' | 'silent' }` when a component owns its own error UI. The transport itself never
   produces toasts, redirects, or any other UI.

## Package Guide

### @ottabase/ottaorm

Fat model ORM. Core models: User, Post, Tag, Account, Session.

```typescript
import { BaseModel, setDriver, autoInit, collectTableSchemas, User, Post, Tag } from '@ottabase/ottaorm';
```

### @ottabase/db

D1 database driver.

```typescript
import { createD1Driver } from '@ottabase/db/drizzle-d1';

const driver = createD1Driver(env.OBCF_D1);
setDriver(driver);
```

### @ottabase/cf

Cloudflare service wrappers.

```typescript
import { createD1Client } from '@ottabase/cf/d1';
import { createKVClient } from '@ottabase/cf/kv';
import { createR2Client } from '@ottabase/cf/r2';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
```

### @ottabase/auth

Lightweight in-house auth (no Auth.js/NextAuth). Web-Crypto only: signed session-cookie JWT + PBKDF2 credentials +
generic OAuth2/OIDC + magic links. Config is env-driven (`AUTH_SECRET`, `AUTH_URL`, `AUTH_*`); there is no `AuthConfig`
object to build.

**Session data model (MUST understand before touching sessions):** a session is TWO parts.

1. **Signed JWT cookie** (`getSession` verifies it) — carries immutable identity + a display snapshot at issue time. It
   is NOT re-signed until the user logs in again, so its `name`/`image` copies go stale after a profile edit.
2. **KV registry snapshot** (`ottabase.session-token` → KV, per `jti`) — the MUTABLE half. It holds
   org/roles/permissions AND the mutable display fields (name/image/emailVerified), and is re-read from D1 whenever the
   per-user `profile:version` KV counter is bumped. `getSession` prefers the snapshot over the JWT for these fields (see
   `buildUser`), so mutations reflect on the next request without re-issuing the cookie.

**Backend — `getSession(request, env)` is globally usable** from any worker route (import from
`@ottabase/auth/backend`); it fails closed without KV. Read identity via
`session.user.{id,email, name,image,organizationId,roles,permissions}`.

```typescript
import { getSession } from '@ottabase/auth/backend';
const session = await getSession(request, env);
if (!session) return errorResponse('Unauthorized', 401);
```

**Client — `useSession()` is the single global source of truth** (module-level Jotai atoms, shared by every caller; the
app wraps it in `@/lib/auth` to also sync `@ottabase/state`). Import `useSession` from `@/lib/auth` in app code. Never
keep a private copy of `user` — read it from the hook so the header (`UserSection`), guards, and every consumer
re-render together.

```typescript
const { user, isAuthenticated, updateUser, refreshSession, logout } = useSession();
```

**METHODOLOGY — making a mutated user field reflect everywhere (do ALL of these):**

1. **Server field plumbing:** the field must live in the KV snapshot path — add it to `RegistrySnapshot`, `UserContext`,
   `loadUserContext`, `parseSnapshot`, and `buildUser` in `packages/auth/src/session-store.ts`
   (org/roles/perms/name/image/emailVerified already are). JWT-only fields will NOT refresh.
2. **Bump the version on write:** the mutating endpoint MUST bump the TARGET user's profile version so `getSession`
   re-reads the snapshot — call the shared helper `bumpProfileVersion(env, userId)` from `worker/lib/auth-utils.ts` (do
   NOT hand-roll the KV write). A DB write WITHOUT a version bump is invisible to live sessions until the cookie JWT
   expires (up to `AUTH_SESSION_MAX_AGE`, ~30 days). Examples: `PATCH /api/users/me`, email verification, and admin
   membership changes all bump it. Role-DEFINITION changes affect MANY users: enumerate holders
   (`UserRole.where({ roleId })`) and bump each (see `admin-roles.ts`).
3. **Client refresh:** after the mutating request resolves, call `updateUser({ field })` for instant optimistic UI AND
   `refreshSession()` to reconcile from the server. Both go through the hook, so all `useSession()` consumers (top-right
   name/avatar, etc.) update. Do not `window.location.reload()`. Note: `refreshSession()` REPLACES the session from the
   server, so a client-only field not in the snapshot (e.g. `timezone`) must be re-applied via `updateUser` after the
   refresh.
4. **Membership/permission changes** additionally invalidate the RBAC + membership caches (`invalidateMembershipCache`,
   `rbac:` prefix) — see `worker/lib/auth-utils.ts`. Do BOTH the cache invalidation AND the profile-version bump: the
   caches gate the request-context path, the version bump gates the session-snapshot path.

### @ottabase/state

Global state (Jotai).

```typescript
import { createAppState } from '@ottabase/state';

const { appStateAtom, atoms } = createAppState();
export const { themeAtom, userAtom, scaleAtom } = atoms;
```

### @ottabase/utils

Utilities with tree-shakeable imports.

```typescript
import { toUTC, formatInUserTimezone } from '@ottabase/utils/timezone';
import { makeSlug, isValidUrl } from '@ottabase/utils/url';
import { changeCase, isEmail } from '@ottabase/utils/string';
import { sanitizeInlineHtml, sanitizeJsonForScript, sanitizeCssForStyleTag } from '@ottabase/utils/sanitize';
```

### @ottabase/ottablog

Blog engine core logic and models.

```typescript
import { Post } from '@ottabase/ottablog';
import { Tag } from '@ottabase/ottaorm';
```

### @ottabase/ui-datatable

Advanced data table built on TanStack Table v8. Server-side sort/filter/pagination, column visibility, row selection,
bulk actions. Powers the list view in `@ottabase/forms` ModelCrud.

```typescript
import { DataTable, useDataTable, createColumns, actionsColumn, selectColumn } from '@ottabase/ui-datatable';
import { useServerTable } from '@ottabase/ui-datatable'; // OttaORM server-side integration
```

### @ottabase/premium

Premium Packages framework: manifests, offline license verification, entitlements, lifecycle hooks, gated route mounting
and a drop-in admin surface. Inert until a package is registered — an app that sells nothing pays nothing.

```typescript
// Install (the whole job): apps/*/ottabase/config.premium.ts
export const PREMIUM_PACKAGES = [createWebhooksPackage({ resolveCaller })];

// Enforce (worker)
import { requirePremiumFeature } from '@ottabase/premium/server';
const denied = await requirePremiumFeature(premium, env, 'webhooks', 'deliveries.log');
if (denied) return denied; // 402 PREMIUM_REQUIRED

// Gate (browser) — a UX affordance; the server guard above is the boundary
import { PremiumGate } from '@ottabase/premium/react';
```

See `docs/PREMIUM_PACKAGES.md`; `@ottabase/premium-webhooks` is the worked example.

### @ottabase/queue

Laravel-style job queue for Cloudflare Queues.

```typescript
import { dispatch, createRegistry, createQueueHandler } from '@ottabase/queue';

// Dispatch jobs
await dispatch(env.MY_QUEUE, 'send-email', { to: 'user@example.com' });

// With deduplication, chaining, priority
await dispatcher.dispatch('sync-user', payload, {
    uniqueKey: 'user-123', // Deduplication
    priority: 'high', // Priority queues
    then: [{ type: 'notify' }], // Job chaining
});

// Process jobs
const registry = createRegistry<Env>().register('send-email', async (job, ctx) => {
    /* handler */
});

export default { queue: createQueueHandler(registry) };
```

### @ottabase/cf-realtime

WebSocket pub/sub (Pusher alternative).

```typescript
// Client
import { RealtimeClient } from '@ottabase/cf-realtime';
client.subscribe('channel', (event, data) => {});

// Server
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
await broadcaster.send('channel', 'event', { data });
```

## Adding a New Package with Model

When a package provides its own database table:

### 1. Package: Export schema

```typescript
// packages/mypackage/src/schema.ts (or src/persistence for complex packages)
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable('mytable', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});
```

### 2. App: Register in config.migrations.ts

Add to PACKAGE_REGISTRY and ottabase.config.ts `packages` (built-in) or `customPackages` (custom). For custom packages,
also add route handlers in `ottabase/config.routes.ts`.

### 3. App: Create model

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

### 4. App: Register model in db-utils.ts

Add `MyModel` to the appropriate array in `worker/lib/db-utils.ts` initDbConnection.

### 5. App: Export table and create hooks

```typescript
// ottabase/db/schema.ts
export { myTable } from '@ottabase/mypackage/schema';

// ottabase/hooks/useMyModel.ts
export const { useList, useCreate, useUpdate, useDelete } = createModelHooks({ entityName: 'mytable' });
```

### 6. Run migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Dependency Rules

### Adding New Dependencies

**Decision flow:**

1. **Will multiple packages/apps use this?** → Add to `pnpm-workspace.yaml` catalog
2. **Only one package/app needs it?** → Add directly to that package's `package.json`
3. **Is it a framework/runtime dep for a shared package?** → Add as `peerDependency`

### When to Use Catalog (pnpm-workspace.yaml)

Add to catalog when:

- Used by 2+ packages/apps (react, typescript, drizzle-orm)
- Core framework libraries (tailwind, tanstack, jotai)
- Shared tooling (tsup, vitest, eslint)

```yaml
# pnpm-workspace.yaml
catalog:
    react: ^19.2.4
    typescript: ^5.9.3
    drizzle-orm: ^0.38.3
```

Then reference in package.json:

```json
{ "react": "catalog:" }
```

### When to Use Local (package.json only)

Add locally when:

- Package-specific utility (e.g., `editorjs` only in `ottaeditor`)
- App-specific tool not needed elsewhere
- Experimental/testing before promoting to catalog

```bash
# Add to specific package
pnpm add --filter @ottabase/ottaeditor @editorjs/editorjs

# Add to specific app
pnpm add --filter @ottabase/otta-web some-package
```

### Workspace Protocol

Internal packages always use `workspace:*`:

```json
{ "@ottabase/ottaorm": "workspace:*" }
```

### Peer Dependencies

Shared packages declare framework deps as peers to avoid duplication:

```json
{
    "peerDependencies": {
        "react": "catalog:",
        "drizzle-orm": "catalog:"
    }
}
```

### Adding to Catalog Steps

```bash
# 1. Add to pnpm-workspace.yaml catalog section
# 2. Add to root package.json if needed for scripts
pnpm add -w new-package

# 3. Reference in consuming package.json
{ "new-package": "catalog:" }

# 4. Install
pnpm install
```

## File Locations

| Purpose           | Location                                            |
| ----------------- | --------------------------------------------------- |
| Models            | `apps/*/ottabase/models/`                           |
| Schema            | `apps/*/ottabase/db/schema.ts`                      |
| Schema collection | `apps/*/ottabase/db/schemas-helper.ts`              |
| Package registry  | `apps/*/ottabase/config.migrations.ts`              |
| Model registry    | `apps/*/worker/lib/db-utils.ts` (initDbConnection)  |
| Custom routes     | `apps/*/ottabase/config.routes.ts`                  |
| Premium Packages  | `apps/*/ottabase/config.premium.ts`                 |
| App config        | `apps/*/ottabase/ottabase.config.ts`                |
| Client hooks      | `apps/*/src/ottabase/hooks/` or `apps/*/src/hooks/` |
| Migrations        | `apps/*/ottabase/migrations/`                       |
| API routes        | `apps/*/worker/routes/router.ts`                    |
| Pages             | `apps/*/src/pages/`                                 |

## Anti-Patterns

- Circular deps between packages
- Direct file imports across package boundaries
- Framework-specific code in generic packages
- Package-specific lock files
- Implicit dependencies
- Missing type definitions
- Models without `static entity` and `static table`
- Using npm or yarn instead of pnpm
- Using OttaORM for Menu/MenuItem (use `/api/brand/menus` instead)

## Commands Reference

### Otta CLI (Recommended)

The `otta` CLI provides a streamlined interface for common monorepo tasks:

```bash
# Scaffolding
otta new web my-app              # Create a new web app (Vite + TanStack Router + Workers)
otta new landing my-site         # Create a new landing page (Next.js + Workers)
otta templates                   # Show available templates

# Development
otta dev otta-web                # Start dev server for an app
otta dev otta-landing --port 3005  # Start with custom port

# Building & Testing
otta build otta-web              # Build an app for production
otta test otta-web               # Run tests
otta test otta-web --watch       # Run tests in watch mode
otta test otta-web --coverage    # Run tests with coverage

# Quality
otta lint otta-web               # Lint an app
otta lint otta-web --fix         # Lint and auto-fix
otta type-check otta-web         # Type check an app (alias: otta types)

# Info
otta list                        # List all apps (alias: otta ls)
otta info otta-web               # Show detailed app info
otta clean otta-web              # Clean build artifacts
```

### pnpm Commands

`pnpm commands` prints every root script as a grouped table (filter with `pnpm commands <text>`). It is generated from
`package.json`, so prefer it over guessing a script name. When you add a root script, add its description to
`COMMAND_REGISTRY` in `packages/scripts/src/cli/help.ts` — a test fails otherwise.

```bash
# Discovery
pnpm commands                     # Every script, grouped and annotated

# Dev
pnpm dev                          # All apps
pnpm dev:be                       # Worker only

# Build
pnpm build                        # Everything
pnpm build:pkg                    # Packages only
pnpm test --filter=@ottabase/ottaorm

# Quality
pnpm lint
pnpm type-check

# Docs
pnpm storybook
```

## VS Code

Install recommended extensions in `.vscode/extensions.json` for Prettier format-on-save.

### IMPORTANT NOTES FOR CODING AGENTS

- **Build commands:** Agents should only run build and test commands for a particular package using the `--filter` flag
  (e.g., `pnpm build:pkg --filter=<package>` or `pnpm test --filter=<package>`). Do not run full app builds
  (`pnpm build`, `pnpm dev`, etc.) unless you are a cloud agent; only cloud agents may execute full builds or dev
  workflows. Local development user is responsible for running full app builds, and shall share output with the agent as
  required.
- Do not make stray .MD files after a task (like SUMMARY.MD)
- Do not remove existing documentation or comments inside files, unless it is deemed incorrect or outdated after careful
  review. If you find something that is wrong, add a comment in the code and also update the documentation to reflect
  the correct information.
- Add comments in code snippets to explain what they do, especially for complex logic.
- **Create/Edit README.MD and Tests** - whenever you make changes to the codebase, update the appropriate README.MD and
  tests accordingly. Keep `README.MD` concise and focused on the task at hand, with examples. Do not add Possible Issues
  or Troubleshooting sections unless they are directly relevant to the task.
- Use consistent formatting and indentation in code snippets (check `.prettierrc` — 4 spaces, single quotes, LF).
- When adding new packages, ensure they follow the same structure and conventions as existing ones for consistency.
- **Type Safety** — TypeScript only.
- UI must follow minimal design, and use components from `@ottabase/ui-shadcn` where possible to maintain a cohesive
  look and feel across the app. If a new Component that requires design is to be made, add tailwind classes in the
  component, and avoid adding new CSS files unless absolutely necessary.
- New UI created should feel native to the app, and not like a separate module. Design like GitHub's or Notion's pages -
  simple, clean, and functional.
- Golden Rule throughout the repo: KISS, DRY, SIMPLEST SOLUTIONS, and always think about the developer experience for
  future maintainers (including yourself in 6 months).
- When writing code snippets in documentation, ensure they are complete and can be copy-pasted without modification.
  Include necessary imports and context.

## Agent Workflow Checklist

1. **Review documentation first** - Read this file before making changes.
2. **Install dependencies** with `pnpm install` if needed; never use npm or yarn.
3. **Build packages first** with `pnpm build:pkg` when working with shared code.
4. **For code changes**, run quality checks:
    - `pnpm lint` - Lint all packages
    - `pnpm type-check` - TypeScript validation
    - `pnpm test --filter=<package>` - Run tests scoped to the package you changed
5. **When adding dependencies**, follow the decision flow above.
6. **For model changes**, ensure:
    - Model has `static entity` and `static table`
    - Table is exported in `ottabase/db/schema.ts`
    - Model is added to `worker/lib/db-utils.ts` initDbConnection if CRUD API needed
    - Run `curl -X POST http://localhost:3004/api/ottaorm/init` to apply migrations

### CI / PR Checklist

- **CI:** Run `pnpm build:pkg && pnpm test --filter=@ottabase/ottaorm` before opening a PR.
- **Checks:** Ensure `pnpm lint` and `pnpm type-check` pass locally or in CI.
- **Formatting:** Ensure Prettier formatting is applied; enforce via pre-commit hooks (`husky` + `lint-staged`).
- **PR Description:** Add a short summary, list affected packages, testing notes, and any required migration steps.

### Formatting / Pre-commit

- **Format command:** `pnpm format` (runs `prettier --write .` on the whole repo).
- **Pre-commit:** We recommend `husky` + `lint-staged` to run format and basic lint on staged files.

### Maintainers / Contacts

- **Maintainer:** @thinkdj: architecture questions & exceptions.
- **Escalation:** Open an issue with the `architecture` label or ping the `#dev-ops` channel.

</INSTRUCTIONS>

---

## Cursor Cloud specific instructions

### Environment

- **Node.js 24+** is required (`.nvmrc` says `24`). Use `nvm install 24 && nvm use 24` if needed.
- **pnpm 10.27.0** is the package manager. Install via `corepack enable pnpm`.
- **No Docker** required — all infrastructure is Cloudflare-native and emulated locally by Wrangler.

### Starting the dev servers

The `pnpm dev` command (or `node dev.js --noopen`) starts both Vite (port 3003) and Wrangler (port 3004) in parallel.
Key caveats for Cloud agents:

1. **Wrangler needs a `dist/` directory** in `apps/otta-web/`. If it doesn't exist (first run, or after `pnpm clean`),
   create it: `mkdir -p apps/otta-web/dist && echo '<html></html>' > apps/otta-web/dist/index.html`.
2. **Wrangler needs `CLOUDFLARE_API_TOKEN`** in non-interactive (headless) environments. Set a dummy value for local
   dev: `export CLOUDFLARE_API_TOKEN=dummy-local-dev`. Use `--local` flag if needed.
3. Start the servers separately for better control:
    - Backend: `cd apps/otta-web && CLOUDFLARE_API_TOKEN=dummy-local-dev npx wrangler dev --port 3004 --local`
    - Frontend: `cd apps/otta-web && npx vite --port 3003`
4. **Build scripts for native packages** (esbuild, workerd) may be ignored by pnpm. After `pnpm install`, run:
   `for dir in node_modules/.pnpm/esbuild@*/node_modules/esbuild; do (cd "$dir" && node install.js); done` and
   `for dir in node_modules/.pnpm/workerd@*/node_modules/workerd; do (cd "$dir" && node install.js); done`.

### First-run bootstrap

After both servers are running, the platform requires bootstrap (creates DB tables + seeds roles + creates the platform
owner account, which holds the system-scoped `platform_owner` role). Use the `/__bootstrap__` API:

`POST /__bootstrap__/api/init` clears the entire **OBCF_KV** namespace first (platform state cache, RBAC, queue, rate
limits), then runs migrations — use this for a clean fresh install when KV may contain stale keys.

```bash
BOOTSTRAP_SECRET=$(grep BOOTSTRAP_OWNER_SECRET apps/otta-web/.env.local | cut -d= -f2)
curl -s -X POST http://localhost:3004/__bootstrap__/api/init -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
curl -s -X POST http://localhost:3004/__bootstrap__/api/seed -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
curl -s -X POST http://localhost:3004/__bootstrap__/api/create-owner -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET" -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"<your-secure-password>","name":"Admin"}'
curl -s -X POST http://localhost:3004/__bootstrap__/api/finalize -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
```

### Commands reference

See `README.md` and `AGENTS.MD` above for full command reference. Key commands:

- `pnpm build:pkg` — build shared packages (required before first dev run)
- `pnpm lint` — lint all packages (note: `@ottabase/ottalayout` has a pre-existing lint failure)
- `pnpm test` — run all tests via Vitest + Turborepo
- `pnpm type-check` — TypeScript validation

#### Misc

- Template apps were previously named `ottabase-template-app-tanstack`, `ottabase-template-app-nextjs-homepage` and were
  later renamed to `otta-web` and `otta-landing` for clarity. If old references appear in docs or code, they can
  generally be ignored or updated to `otta-web` or `otta-landing`.
