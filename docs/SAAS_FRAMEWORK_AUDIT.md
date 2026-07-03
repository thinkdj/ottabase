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

#### C. Indexed the brand-engine config tables (HTML-render hot path)

Brand/layout/menu resolution runs on **every HTML request that misses the brand KV cache**, looking up an app's brand
kit, layout templates, route mappings, menu-slot assignments and menus by `app_id` — all unindexed. Added app-scoped
indexes (`brand_kits(appId,isDefault)`, `layout_templates(appId)`, `layout_route_mappings(appId,priority)`,
`menu_slot_assignments(appId,slotName)`, `menus(appId,slug)`), backfilled on init.

#### D. Memoized the per-model Zod validation schema

`create`/`update` validate on every write via `getZodSchema()`, which rebuilt the schema from field metadata each call
despite `fields`/`writable` being static. Now cached per class + mode in a `WeakMap`
(`packages/ottaorm/src/base/AbstractBaseModel.ts`).

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

9. **🔧 Frontend fetch waterfalls & refetch storms (confirmed high-value, quick).**
    - No route preloading — every navigation is a serial _chunk-fetch → data-fetch_ waterfall. Set
      `defaultPreload: 'intent'` on the router (`apps/otta-web/src/router.tsx:599`) so the chunk warms on hover.
    - Global TanStack Query defaults refetch on every window-focus/mount/reconnect with only 30s `staleTime`
      (`packages/ottaorm/src/client/QueryProvider.tsx:25`) — raise `staleTime` and set `refetchOnWindowFocus: false`.
    - Render-blocking Google Fonts (4 families, many weights) from a third-party CDN in `index.html` — self-host the 1–2
      weights needed for first paint and `rel=preload` them.

10. **🔧 Realtime fan-out is O(connections).** `RealtimeActor` scans every connected client per channel publish
    (`packages/cf-realtime/src/server/RealtimeActor.ts:351`). Maintain a `Map<channel, Set<clientId>>` so fan-out is
    O(subscribers). Bites once a Durable Object holds many connections.

11. **🔧 Systemic index safety-net.** Have the runtime generator auto-emit a tenant index for any table with
    `organization_id`/`app_id`/`user_id` that lacks a covering declared index (`migrations/runtime-generator.ts:474`),
    or lint at init — so app/custom models can't silently ship unindexed (the exact class of bug fixed manually above).

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

| Gap                                          | Sev    | Effort | Notes                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-org custom roles/permissions**         | must   | L      | ⚠️ RLS declares `roles`/`permissions` as `TenantScoped` (filter `organizationId`) but **those tables have no `organizationId` column** — roles are globally scoped. Real B2B SaaS needs org-defined roles. Latent misconfig: routing roles through secure CRUD would fail closed. |
| **Team invite by email (accept → seat)**     | must   | M      | ⚠️ Broken today: the admin invite route hard-requires an existing `userId` and 404s otherwise (§4-5), so you can't invite someone without an account — despite `invitedEmail` + `activatePendingInvites` existing. Wire the tokenized email flow.                                 |
| SSO / SAML / SCIM (enterprise)               | should | XL     | Absent; gating factor for enterprise deals.                                                                                                                                                                                                                                       |
| Org ownership transfer                       | should | S      | Last-owner guardrails exist for removal; no transfer.                                                                                                                                                                                                                             |
| Custom domain / subdomain-per-tenant routing | should | L      | `organizationId` is derived from subdomain, but no domain-provisioning story.                                                                                                                                                                                                     |

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

| Gap                                                        | Sev    | Effort | Notes                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code generators** (`otta g model/route/page/crud/admin`) | must   | M      | CLI scaffolds apps only. A partial `db-generate` exists in `@ottabase/scripts` but is **not built or wired** into the CLI. The value prop is speed — finish generators for model+schema+hooks+forms+admin CRUD. |
| **Registry-driven admin (CrudHub)**                        | must   | L      | `getAllModelsMetadata()` exists but no generic admin renders from it — every admin page (users, RBAC, blog, orgs) is bespoke, so the metadata is dead plumbing.                                                 |
| Auto-admin CRUD from model metadata                        | should | L      | `@ottabase/forms` auto-generates forms; extend to full admin resource pages (list/detail/edit) from the model registry.                                                                                         |
| Env-var validation + typed config at boot                  | should | S      | Fail fast on missing/invalid env with a schema.                                                                                                                                                                 |
| Upgrade/merge-from-upstream tooling                        | should | M      | "You own the code" fork model needs a documented, tooled update path.                                                                                                                                           |
| One-command provision + deploy                             | should | M      | `cf:setup` exists; smooth it into a single guided deploy.                                                                                                                                                       |

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

| Gap                                      | Sev    | Effort | Notes                                                                                                                                                                     |
| ---------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RAG / embeddings (Vectorize) + retrieval | should | L      | `@ottabase/cf-ai` covers chat/gateway; no vector store / RAG.                                                                                                             |
| Agent/tool-use scaffold                  | nice   | L      | Building block for AI-native SaaS.                                                                                                                                        |
| Scheduled + event-driven jobs UX         | should | M      | Queue is wired; **cron is not — the worker has no `scheduled()` handler (§4-4)**. Wire it, then add a jobs dashboard + retry/DLQ UX (DLQ admin exists — surface it well). |

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
4. **Cron/scheduled jobs are not wired.** The worker exports `fetch` and `queue` but **no `scheduled()` handler**
   (`cloudflare-worker.ts:40-137`), and there are no cron triggers in the Wrangler config. So `@ottabase/cron`'s DB
   scheduler (and anything meant to run on a timer — cleanup, drip emails, scheduled publish, backups) can be defined
   but never fires on a schedule. Wiring `scheduled()` unblocks a whole tier of features.
5. **Invite-by-email is dead plumbing.** `handleAdminOrganizationInviteMember` hard-requires an existing `userId` and
   404s if the user doesn't exist (`admin-organization-members.ts:101-127`), even though the schema has `invitedEmail`
   and `OrganizationMember.activatePendingInvites(userId, email)` exists. A founder literally cannot invite a teammate
   or customer who doesn't already have an account — the single most important team feature is non-functional.
6. **Org creation can half-commit.** Creating an organization inserts the org and then, in a separate statement, the
   owner `OrganizationMember` (`ottaorm-crud.ts:215-239`). `BaseModel.batch` is raw-SQL-string only, so there is no real
   transaction — if the membership insert fails, the org exists with no owner. Needs an atomic multi-model write.
7. **`AUTH_SECRET` has an insecure fallback on the bootstrap path.** `bootstrap/routes.ts:545` uses
   `env.AUTH_SECRET || 'dev-secret-change-in-production'`, so a deploy missing the secret can sign with a public
   constant instead of failing. (The main auth handler does throw in production — the inconsistency is the risk.)
8. **CORS reflects an arbitrary `Origin` with credentials.** `buildCorsHeaders` echoes the request `Origin` (default
   `*`) and sets `Access-Control-Allow-Credentials: true` (`router.ts:145-154`) — any origin can make credentialed
   cross-site requests. Replace with an allowlist.
9. **`BaseModel.delete` returns `true` unconditionally** without `RETURNING`/`changes` (`base/BaseModel.ts:685`), so it
   cannot report not-found. Masked today by the pre-verify read; any atomic-write rewrite (§2.2-1) must switch to
   `RETURNING` to detect 0 rows affected.
10. **Plaintext OAuth tokens.** Access/refresh tokens are stored unencrypted in `accounts`; add field-level encryption.

---

## 5. Prioritized roadmap

**First 5 a solo founder will hit (do these next):**

1. Index backfill ✅ (shipped) — re-run `/api/ottaorm/init` in prod to apply.
2. **Code/CRUD/admin generators** — the speed promise. Note a partial `db-generate` exists in `@ottabase/scripts` but is
   **not built or wired into the CLI**, and `getAllModelsMetadata()` exists with **no generic admin (CrudHub)** that
   renders from it. Finish the loop: `otta g model|crud|admin` + a registry-driven admin — §3.6.
3. **Wire the async runtime** — add the `scheduled()` handler (and Wrangler cron triggers) so `@ottabase/cron`, backups,
   drip emails and cleanup actually run; the queue is wired but the timer half is not — §4-4.
4. MFA/passkey + account deletion & data export + the security-headers/CORS-allowlist/rate-limit bundle — trust,
   compliance, and every security review — §3.1/§3.4/§4-7/§4-8.
5. Fix the two broken team primitives: **invite-by-email** (§4-5) and **per-org roles** (§3.2/§4-1).

**Top 10 highest-leverage overall:**

1. Model→CRUD→admin generators + registry-driven admin (§3.6)
2. Public API + scoped API keys + outbound webhooks + typed SDK (§3.3)
3. Wire `scheduled()`/async runtime so cron/queue/notifications actually fire (§4-4)
4. MFA/passkeys, account deletion, GDPR export, field-level token encryption (§3.1/§3.4/§4-10)
5. Security hardening bundle: CSP/HSTS headers, CORS allowlist, rate-limit all public routes (§4-7/§4-8)
6. Per-org RBAC + working team invite lifecycle (§3.2/§4-1/§4-5)
7. ORM correctness+scale bundle: real transactions, JOIN eager-loading, cursor pagination, bulk ops (§2.2/§4-6)
8. Migration versioning + backups/restore + migrations-in-deploy (§3.5)
9. Observability wiring: Sentry + real health probes + alerting; feature flags (§3.7)
10. SSR/SEO for content + single design system + frontend waterfall fixes (§2.2-9/§3.8)

---

## 6. Cross-check — multi-agent verification pass

The findings above were cross-checked by an automated audit (74 sub-agents: 9 subsystem perf/architecture readers, 10
SaaS-domain gap analysts, a completeness critic, and an adversarial verification pass over every performance claim).

**Verification outcome:** 54 raw performance findings → **43 confirmed, 8 plausible, 3 rejected**. Notably, two of the
three _rejected_ findings were rejected **specifically because the fixes shipped on this branch already resolved them**
— the verifier found the tenant/scope columns already indexed and `createD1Driver` already `WeakMap`-memoized. In other
words, the independent pass re-derived §2.1 A/B and confirmed they close the issue.

Everything the audit surfaced that materially sharpened the analysis has been folded into the sections above (the
frontend waterfalls in §2.2-9, realtime fan-out §2.2-10, the systemic index safety-net §2.2-11, and the
correctness/security items §4-4…§4-10). No confirmed finding contradicted this report's conclusions.

---

_Performance items marked ✅ are implemented and tested on branch `claude/saas-framework-audit-rct5hc` (4 optimizations
across the data, edge-render and ORM layers; `@ottabase/db` + `@ottabase/ottaorm` type-check clean, 211 package tests
green including 11 new index regression tests)._
