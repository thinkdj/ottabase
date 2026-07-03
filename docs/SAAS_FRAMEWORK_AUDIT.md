# Ottabase Audit — Performance & SaaS-Framework Gap Analysis

> Scope: (1) understand the framework, (2) improve runtime performance (re-architecting where sub-optimal), (3)
> enumerate what is missing to be a _killer solo-founder SaaS framework_. **Billing/payments is intentionally excluded**
> (planned premium package).
>
> Status legend: ✅ shipped on this branch · 🔧 recommended (not yet implemented) · ⚠️ correctness/latent bug

---

## 1. How the framework works (the 60-second model)

Ottabase is an **edge-native, batteries-included SaaS monorepo** built entirely on Cloudflare primitives (Workers +
D1/SQLite + KV + R2 + Queues + Durable Objects). ~50 workspace packages, two apps (`otta-web` = TanStack Router SPA
served from the Worker; `otta-landing` = Next.js marketing).

**Request lifecycle** (`apps/otta-web/cloudflare-worker.ts`):

```
fetch → kill-switches → bootstrap gate (resolvePlatformState: isolate-memo → KV → D1 probe)
      → ensureDbConnection (register D1 driver + models + RLS, idempotent per isolate)
      → API router (@ottabase/ottarouter) → generic OttaORM CRUD / package routes / custom routes
      → shortlink fallback → static assets (+ brand critical-CSS injection on HTML)
```

**Data model** is a fat Active-Record ORM (`@ottabase/ottaorm`, `BaseModel`) over Drizzle/D1. The generic CRUD endpoint
(`/api/ottaorm/:entity`) resolves the session, builds a `SecurityContext`, and runs every read/write through a
**Row-Level-Security engine** that auto-injects tenant/user/app filters. This is the framework's best idea: data
isolation is enforced by default, not per-query.

**Strengths worth preserving:** the RLS-by-default model; config-driven package composition; idempotent runtime
migrations that backfill schema _and indexes_; the order-free router; the bootstrap state machine; genuinely broad
feature packages (blog/CMS, realtime, queues, cron, brand engine, media library, referrals, shortlinks, analytics).

---

## 2. Performance

### 2.1 Shipped on this branch ✅

#### A. Indexed the core hot-path tables (the single biggest win)

SQLite **only** auto-creates indexes for `PRIMARY KEY` and `UNIQUE` columns. The RLS engine filters **every**
tenant-scoped query by `organizationId` / `userId` / `appId`, and listings order by `createdAt` — none of which were
indexed on the core tables. Newer feature packages (blog = 13 indexes, referrals = 5, comments = 4) were already
indexed; the **core auth/tenant/RBAC tables shipped with zero secondary indexes**. Every such query was a full table
scan that degrades linearly as data grows — worst on `audit_logs` (append-only, unbounded) and `media`.

Added indexes matching the real query patterns (RLS engine, Auth.js adapter, RBAC resolver, cron poll, admin/library
listings):

| Table                 | Indexes added                                                         | Serves                                            |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| `accounts`            | `(provider, providerAccountId)`, `userId`                             | Auth.js `getUserByAccount` on every OAuth sign-in |
| `sessions`            | `userId`                                                              | sign-out / "log out everywhere"                   |
| `organizations`       | `ownerId`                                                             | org RLS fallback filter                           |
| `audit_logs`          | `(organizationId, createdAt)`, `userId`, `(resourceType, resourceId)` | tenant-scoped audit reads + admin filters         |
| `media`               | `(organizationId, createdAt)`, `userId`, `appId`                      | media library listing                             |
| `user_roles`          | `(userId, organizationId)`, `roleId`                                  | RBAC role resolution                              |
| `verification_tokens` | `token`                                                               | email verify / password reset                     |
| `scheduled_tasks`     | `(isActive, nextRunAt)`                                               | DB-backed cron poll                               |
| `tags`                | `appId`                                                               | app-scoped tag listing                            |
| `users`               | `referredById`                                                        | referral attribution                              |
| `authenticators`      | `userId`                                                              | passkey listing                                   |
| `shortlinks`          | `appId`                                                               | dashboard listing (`shortCode` already unique)    |

Emitted by the runtime generator as `CREATE INDEX IF NOT EXISTS`, so re-running `/api/ottaorm/init` **backfills them
onto existing production tables with zero data risk**. A new regression test (`core-schema-indexes.test.ts`) pins each
index.

#### B. Memoized the D1 driver per binding

`createD1Driver(env.OBCF_D1)` was called once (often several times) per request across ~20 handlers, rebuilding a
Drizzle instance each time for a binding that never changes within an isolate. Now cached in a `WeakMap` keyed by the
binding; config-bearing calls still get a fresh driver. Removes redundant per-request allocation everywhere at once
(`packages/db/src/drizzle/drizzle-d1.ts`).

### 2.2 High-value recommendations (not yet implemented)

1. **🔧 Collapse the read-before-write in secure CRUD.** `secureCrud` runs a full `GET` verify query before **every**
   `PATCH`/`PUT`/`DELETE`, then a second query for the write — 2+ D1 round-trips per mutation
   (`packages/ottaorm/src/rls/secure-crud.ts:511`, `:552`). Replace with a single atomic
   `UPDATE/DELETE … WHERE pk = ? AND <rlsFilter> RETURNING *`; zero rows returned ⇒ 404 (same signal as today, one fewer
   round-trip). Requires a `BaseModel.updateWhere/deleteWhere` that accepts extra conditions. Medium risk (touches the
   security boundary) — keep the RLS filter in the `WHERE` and preserve `validateWrite`'s tenant-id injection.

2. **🔧 `SELECT *` everywhere.** `BaseModel` always selects all columns then constructs an instance per row and calls
   `.toJson()` (`base/BaseModel.ts:312`). For list endpoints this ships columns the client never uses (e.g.
   `password_hash` is stripped only by `hidden`, after being read). Add optional column projection to `where/paginate`
   and have the CRUD list path request only needed columns. Cuts D1 payload + serialization CPU.

3. **🔧 Real eager-loading — the `connect`/`with` DSL is dead config.** `AbstractBaseModel` declares `static connect` /
   `static with` (`base/AbstractBaseModel.ts:233,238`) and the docs advertise a join DSL, but **nothing consumes them**.
   Relations load via N+1 (`loadAll` calls each instance's relation method in parallel — one query per row per
   relation). Implement batched loading (`whereIn` + in-memory grouping) behind `with`, or delete the dead API. High
   leverage for any list-with-relations screen.

4. **🔧 Move audit + analytics writes off the response path.** Audit-log writes and WAE analytics are awaited inline;
   `ctx.waitUntil` is only used in cron/router today. Route non-critical side effects through `ctx.waitUntil(...)` so
   the response isn't blocked on a D1 insert / WAE write.

5. **🔧 RBAC cache: memoize the org cache-version per request.** `RBACCache.getOrgCacheVersion` does a KV read on
   **every** `buildCacheKey`, so `getUserContext + getUserRoles + getUserPermissions` = 3–6 KV reads where 1 would do
   (`packages/rbac/src/cache.ts:181`). Store the version in the existing request-cache. (Colder path than the main CRUD
   flow, which reads roles/permissions from the session JWT — but free wins for any route using `rbacMiddleware`.)

6. **🔧 Frontend: dual UI kit + bundle.** The SPA ships **both Mantine and shadcn/ui**, EditorJS with 15+ plugins, and
   `manualChunks` only splits `tanstack` + `ottaeditor` (`vite.config.ts:96`). Pick one primary UI kit (or lazy-load
   Mantine only where used), verify per-route code-splitting via TanStack Router lazy routes, and audit the bundle.
   Also: the SPA has **no SSR** — every page is a client render, which hurts SEO and first paint for marketing/content
   routes (the blog especially).

7. **🔧 Pagination count on large tables.** `paginate` runs `COUNT(*)` with the same filter alongside the data query.
   With the new indexes this is far cheaper, but for large tenant tables consider `hasNextPage` via `LIMIT perPage+1`
   (skip the count) or cursor pagination (see gap #Data-3).

8. **🔧 `getSession` per request.** Every authenticated API request resolves the Auth.js session (D1 lookup). The new
   `sessions(userId)` / unique `session_token` indexes make this a keyed lookup; consider a short KV/isolate cache of
   resolved sessions keyed by token hash for read-heavy bursts.

### 2.3 Notes

- The D1 driver's `execute()` uses `this.db.execute(query)`; batches are raw-SQL-string only
  (`BaseModel.batch(sqls: string[])`) — there is no typed transaction API (D1 has no interactive transactions, but a
  typed `batch([...builders])` wrapper would be safer than string SQL).
- Search is `LIKE '%term%'` across fields (`base/BaseModel.ts:499`) — cannot use an index and can't rank. For real
  search, adopt SQLite FTS5 (see gap #Data-4).

---

## 3. Gap analysis — what's missing for a _killer solo-founder SaaS framework_

Severity: **must-have** (a real SaaS is broken/unsellable without it) · **should-have** (expected, differentiating) ·
**nice-to-have**. Effort: S/M/L/XL. Billing excluded by request.

### 3.1 Auth & user lifecycle

| Gap                                                          | Sev    | Effort | Notes                                                                                                                |
| ------------------------------------------------------------ | ------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| **MFA / 2FA (TOTP) + passkey/WebAuthn flow**                 | must   | L      | ⚠️ An `authenticators` (passkey) table exists but **no backend flow wires WebAuthn or TOTP**. Table without feature. |
| Session revocation UI ("log out everywhere", active-devices) | should | M      | Sessions now indexed by `userId`; needs a UI + endpoint.                                                             |
| Account deletion + self-service data export (GDPR)           | must   | M      | No `deleteAccount` / export flow anywhere (see §3.4).                                                                |
| Login lockout / brute-force throttling                       | should | S      | Some rate-limiting exists on auth routes; formalize lockout + captcha hook.                                          |
| Onboarding flow / first-run wizard                           | should | M      | Bootstrap covers _platform_ init; no per-user onboarding scaffold.                                                   |
| Impersonation ("log in as user") for support                 | should | M      | Common solo-founder support need; none present.                                                                      |

### 3.2 Multi-tenancy & teams

| Gap                                               | Sev    | Effort | Notes                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-org custom roles/permissions**              | must   | L      | ⚠️ RLS declares `roles`/`permissions` as `TenantScoped` (filter `organizationId`) but **those tables have no `organizationId` column** — roles are globally scoped. Real B2B SaaS needs org-defined roles. Latent misconfig: routing roles through secure CRUD would fail closed. |
| Team invite UX end-to-end (email → accept → seat) | should | M      | Primitives exist (`OrganizationMember.activatePendingInvites`); needs a polished flow + emails.                                                                                                                                                                                   |
| SSO / SAML / SCIM (enterprise)                    | should | XL     | Absent; gating factor for enterprise deals.                                                                                                                                                                                                                                       |
| Org ownership transfer                            | should | S      | Last-owner guardrails exist for removal; no transfer.                                                                                                                                                                                                                             |
| Custom domain / subdomain-per-tenant routing      | should | L      | `organizationId` is derived from subdomain, but no domain-provisioning story.                                                                                                                                                                                                     |

### 3.3 Public API, webhooks & integrations

| Gap                                                 | Sev    | Effort | Notes                                                                                              |
| --------------------------------------------------- | ------ | ------ | -------------------------------------------------------------------------------------------------- |
| **User-facing API keys + public REST API**          | must   | L      | No API-key model, no key-auth middleware, no public API surface. A SaaS needs programmatic access. |
| **Outbound webhooks** (events → customer endpoints) | must   | L      | No webhook dispatcher/subscription model.                                                          |
| Inbound webhook receiver (verified signatures)      | should | M      | None (needed for Stripe/GitHub/etc. later).                                                        |
| OpenAPI spec + generated SDK                        | should | M      | No machine-readable API contract.                                                                  |
| Event bus / domain events                           | should | M      | Queue exists but no first-class event/subscriber abstraction.                                      |

### 3.4 Security & compliance

| Gap                                                    | Sev    | Effort | Notes                                                                                                                                  |
| ------------------------------------------------------ | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **GDPR data-subject flows** (export, erasure, consent) | must   | M      | Nothing found for export/erasure; cookie-consent absent.                                                                               |
| CSRF on custom mutation endpoints                      | should | S      | Auth.js routes have CSRF; generic CRUD relies on SameSite cookies + CORS. Add explicit CSRF/double-submit for cookie-authed mutations. |
| Security headers (CSP, HSTS, X-Frame-Options)          | should | S      | CORS is centralized; no CSP/HSTS middleware seen.                                                                                      |
| Secrets rotation + typed secret access                 | nice   | M      | Env vars only.                                                                                                                         |
| Dependency/vuln scanning in CI                         | should | S      | Add `pnpm audit`/Dependabot gate.                                                                                                      |
| Field-level encryption for sensitive columns           | nice   | M      | Tokens stored plaintext in `accounts`.                                                                                                 |

### 3.5 Data layer & ORM ergonomics

| Gap                                       | Sev    | Effort | Notes                                                                                                                                                       |
| ----------------------------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migration versioning & rollback story** | must   | L      | Runtime init is "diff & apply"; custom migrations are tracked but there is no ordered version history, no down-migrations, no dry-run/plan output for prod. |
| Seeding framework (factories, demo data)  | should | M      | RBAC seed exists; no general factory/seed system.                                                                                                           |
| Batched eager-loading / typed relations   | should | L      | See perf §2.2-3 (dead `connect` DSL, N+1).                                                                                                                  |
| Cursor pagination + full-text search      | should | M      | Offset-only pagination; `LIKE` search (no FTS5).                                                                                                            |
| Backups / point-in-time restore guidance  | must   | S      | D1 export/backup runbook + scheduled export to R2.                                                                                                          |
| Typed transaction/batch API               | nice   | M      | Raw-SQL-string batch only.                                                                                                                                  |

### 3.6 DevEx & scaffolding (the solo-founder multiplier)

| Gap                                                          | Sev    | Effort | Notes                                                                                                                                    |
| ------------------------------------------------------------ | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Code generators** (`otta new model/route/page/crud/admin`) | must   | M      | CLI scaffolds apps only. The whole value prop is speed — generators for model+schema+hooks+forms+admin CRUD would be the killer feature. |
| Auto-admin CRUD from model metadata                          | should | L      | `@ottabase/forms` auto-generates forms; extend to full admin resource pages (list/detail/edit) from the model registry.                  |
| Env-var validation + typed config at boot                    | should | S      | Fail fast on missing/invalid env with a schema.                                                                                          |
| Upgrade/merge-from-upstream tooling                          | should | M      | "You own the code" fork model needs a documented, tooled update path.                                                                    |
| One-command provision + deploy                               | should | M      | `cf:setup` exists; smooth it into a single guided deploy.                                                                                |

### 3.7 Observability & ops

| Gap                                          | Sev    | Effort | Notes                                                                                    |
| -------------------------------------------- | ------ | ------ | ---------------------------------------------------------------------------------------- |
| Error tracking wired (Sentry) end-to-end     | should | S      | Logger has a Sentry transport but no turnkey wiring/DSN flow (browser stubbed).          |
| **Feature flags**                            | should | M      | None; solo founders need safe rollouts/kill-per-feature (kill-switches are global only). |
| Metrics dashboard / RED metrics              | should | M      | WAE exists for product analytics; no ops metrics surface.                                |
| Uptime / status page                         | should | M      | None.                                                                                    |
| Structured request tracing / correlation IDs | nice   | M      | Add a request id through logger + audit.                                                 |

### 3.8 Frontend & UX

| Gap                                      | Sev    | Effort | Notes                                                                                                    |
| ---------------------------------------- | ------ | ------ | -------------------------------------------------------------------------------------------------------- |
| Single, consistent design system         | should | L      | Dual UI kit (Mantine + shadcn) — pick one; reduces bundle + inconsistency (perf §2.2-6).                 |
| Data tables/grids (sort/filter/paginate) | should | M      | `ui-datatable` exists; ensure it's wired to the paginated CRUD API as a first-class resource list.       |
| SSR/SSG for content & SEO                | should | L      | SPA-only; blog/marketing routes need SSR or prerender (sitemap/RSS exist, but pages render client-side). |
| a11y + empty/loading/error-state kit     | should | M      | Skeletons exist; formalize a11y pass + standard states.                                                  |
| Notification center (in-app)             | should | M      | `@ottabase/notifications` exists (email/WS); add the in-app inbox UI.                                    |
| PWA/offline                              | nice   | M      | None.                                                                                                    |

### 3.9 Growth & lifecycle

| Gap                                              | Sev    | Effort | Notes                                                                              |
| ------------------------------------------------ | ------ | ------ | ---------------------------------------------------------------------------------- |
| Email templates + broadcast/campaigns            | should | M      | Transactional email present (`@ottabase/email`); no template gallery or broadcast. |
| Waitlist / invite-only launch mode               | should | S      | Common launch pattern; not present.                                                |
| Changelog / release-notes + in-app announcements | should | S      | Docs viewer exists; no changelog surface.                                          |
| Product analytics funnels/retention on WAE       | should | M      | Analytics writes events; add funnel/retention queries + dashboard.                 |
| Feedback/support widget                          | nice   | S      | None.                                                                              |

### 3.10 AI & automation

| Gap                                      | Sev    | Effort | Notes                                                                                         |
| ---------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------- |
| RAG / embeddings (Vectorize) + retrieval | should | L      | `@ottabase/cf-ai` covers chat/gateway; no vector store / RAG.                                 |
| Agent/tool-use scaffold                  | nice   | L      | Building block for AI-native SaaS.                                                            |
| Scheduled + event-driven jobs UX         | should | M      | Queue + cron exist; add a jobs dashboard + retry/DLQ UX (DLQ admin exists — surface it well). |

---

## 4. Correctness / latent issues found along the way ⚠️

1. **`roles` / `permissions` RLS references a non-existent column.** Both are registered `TenantScoped` (filter field
   `organizationId`), but neither table has an `organizationId` column (`rls/registry.ts:94-104` vs
   `models/Role.schema.ts`, `Permission.schema.ts`). `assertSecurityColumns` fails closed, so any secure-CRUD access to
   roles/permissions would 403. Today they're reached via dedicated admin routes, so it's latent — but it also means
   **RBAC roles are not actually org-scoped** (a real multi-tenancy limitation, see §3.2).
2. **Passkey table without a passkey feature** (`authenticators` exists, no WebAuthn flow) — §3.1.
3. **Advertised eager-loading DSL is inert** (`connect`/`with` unused) — §2.2-3. Either implement or remove from the
   docs/model surface to avoid a false capability.

---

## 5. Prioritized roadmap

**First 5 a solo founder will hit (do these next):**

1. Index backfill ✅ (shipped) — re-run `/api/ottaorm/init` in prod to apply.
2. Code generators (`otta new model/crud/admin`) — the speed promise, §3.6.
3. MFA/passkey + account deletion & data export — §3.1/§3.4 (trust + compliance to sell).
4. Per-org roles (fix the schema/RLS mismatch) — §3.2/§4.
5. Public API keys + outbound webhooks — §3.3 (turns a product into a platform).

**Top 10 highest-leverage overall:**

1. Model→CRUD→admin generators (§3.6)
2. Public API + API keys + webhooks (§3.3)
3. Per-org RBAC + team invite UX (§3.2)
4. MFA/passkeys, account deletion, GDPR export (§3.1/§3.4)
5. Migration versioning + backups/restore (§3.5)
6. Collapse read-before-write + real eager-loading (§2.2)
7. Feature flags (§3.7)
8. SSR/SEO for content routes + single design system (§3.8)
9. Error tracking + status/uptime (§3.7)
10. Email templates/broadcast + waitlist + changelog (§3.9)

---

_Performance items marked ✅ are implemented and tested on branch `claude/saas-framework-audit-rct5hc`._
