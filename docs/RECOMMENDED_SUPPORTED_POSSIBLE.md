# Recommended · Supported · Possible

Ottabase is opinionated on purpose (design principle: "prefer one obvious Ottabase way"). Most subsystems allow more
than one approach, but there is always **one canonical path**. This table names it, so a codebase doesn't fragment
across equally-valid-looking options.

Read the columns as:

- **Recommended** — the default. Reach for this unless you have a specific reason not to.
- **Supported** — a legitimate escape hatch for cases the default doesn't cover. Fine when warranted.
- **Possible** — the framework won't stop you, but you're on your own; expect to give up conveniences (caching, tenant
  scoping, type-safety) the default provides. Some rows have **nothing** here because the wrong path is lint-banned.

| Subsystem                  | Recommended                                                                              | Supported                                                                           | Possible                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Data model**             | Fat `BaseModel` (`@ottabase/ottaorm`); logic as model methods                            | Model + custom methods for domain logic                                             | Raw Drizzle / SQL — only for a measured perf need                       |
| **CRUD API**               | Generic route via registered model (`/api/ottaorm/{entity}`)                             | A route in the app package manifest (`ottabase/packages/app.ts`) for non-CRUD needs | Hand-rolled endpoint — avoid                                            |
| **CRUD UI**                | `createModelConfig(Model)` + `<ModelCrud>` (`@ottabase/forms/react`)                     | `<DataTable>` / `useDataTable` primitives                                           | Build the table by hand                                                 |
| **Forms**                  | `createModelConfig` → `<ModelForm>` (model-driven)                                       | `ui-shadcn` `Form`/`FormField` (react-hook-form) for custom forms                   | Native `<form>` + `FormData`                                            |
| **Client data fetching**   | Query/mutation hooks (`createModelHooks`, `useApiQuery`, `useApiMutation`)               | `queryClient.fetchQuery` for imperative reads                                       | ~~Raw `fetch()`~~ — **lint-banned** in `apps/*/src/**`                  |
| **API error responses**    | `errorResponse(...)` / `jsonResponse(...)` (`@ottabase/utils/http-errors`)               | —                                                                                   | ~~`new Response(JSON.stringify(...))`~~ — **lint-banned** on the server |
| **Env access (edge)**      | `getOttabaseConfig(env)`                                                                 | —                                                                                   | ~~`process.env`~~ — **lint-banned** in edge code                        |
| **Styling / components**   | `@ottabase/ui-shadcn` (static Tailwind + design tokens)                                  | `@ottabase/ui-mantine` (Mantine) where its ergonomics help                          | One-off CSS / inline styles that bypass tokens — avoid for repeated UI  |
| **Theming**                | Brand Engine design tokens → CSS variables                                               | Component slot overrides (`data-slot`, `BrandComponentsProvider`)                   | Per-route `tokenOverridesJson` for a localized override                 |
| **State**                  | Jotai (`@ottabase/state`)                                                                | Local component state                                                               | (No competing global-state lib — don't add one)                         |
| **Auth**                   | In-house `@ottabase/auth` (`getSession` / `useSession`)                                  | Generic OAuth2/OIDC + magic links via the same package                              | (No Auth.js/NextAuth — deliberately removed)                            |
| **RBAC / authz**           | Server guard (`hasPermission` / `withRBAC`) as the boundary; browser gate as a UX hint   | App `ProtectedRoute` for route gating                                               | (Never gate on a role _name_ — permission + scope only)                 |
| **Uploads**                | `useFileUpload` / `uploadFile` → `/api/upload`                                           | `uploadFileToR2` / `uploadFileToCloudflareImages` on the server                     | Raw R2 via `@ottabase/cf` when genuinely off-path                       |
| **Background work**        | `dispatch(queue, type, payload)` (`@ottabase/queue`)                                     | `createDispatcher` with priority queues / chaining                                  | Raw `QueueAdapter` / binding via `dispatcher.getAdapter()`              |
| **Database access**        | `@ottabase/db/drizzle-d1` + OttaORM                                                      | Drizzle query builder for a specific hot path                                       | Raw D1 client (`@ottabase/cf/d1`) for non-OttaORM code                  |
| **KV cache keys**          | `@ottabase/cf/cache-keys` builders (`orgKey`, `userKey`, …)                              | `withCache` read-through wrapper                                                    | Hand-formatted key strings — collision risk, avoid                      |
| **Backups / export**       | `@ottabase/vault` listed: nightly `vault:backup` to R2, `GET /api/vault/export/me`       | `vault.backup()` / `restore()` by hand around a risky migration                     | D1 Time Travel alone — Cloudflare's net, not a copy you hold            |
| **Transactional mail**     | `@ottabase/email` templates via the app mailer                                           | `suppressions.guard(mailer)` (`@ottabase/postmaster`) for list mail                 | Sending to a list you never checked against suppressions — avoid        |
| **Inbound mail / bounces** | `@ottabase/postmaster`: Worker `email()` → `email.inbound` on the bus, provider webhooks | A custom `email()` export over `parseInboundEmail`                                  | Polling a mailbox — not a Workers pattern                               |
| **Entitlements / usage**   | `@ottabase/flags` guards (402 `UPGRADE_REQUIRED`) + `@ottabase/meter` credits            | Reading a plan column for one isolated check                                        | Plan names hard-coded in routes — avoid                                 |
| **Customer API access**    | `@ottabase/apikeys` (`authenticate(request, env, { scopes })`)                           | Session cookie for first-party calls                                                | One shared secret in env — avoid                                        |
| **AI / vectors**           | `@ottabase/ottaai` (providers, customer keys, spend) + `@ottabase/cf/vectorize`          | `@ottabase/cf/ai` for a raw Workers AI call                                         | Direct `fetch` to a vendor API                                          |
| **HTML → PDF / scraping**  | `@ottabase/cf-pdf` (safe downloads, metadata)                                            | `@ottabase/cf/browser` quick actions (`pdf`, `markdown`, `json`)                    | `@cloudflare/puppeteer` scripted sessions                               |
| **Timers / long jobs**     | `@ottabase/cron` scheduled tasks + `@ottabase/queue`                                     | `AlarmQueue` inside a Durable Object; `@ottabase/cf/workflows` for multi-step runs  | `setTimeout` in a Worker — lost on eviction                             |
| **App shape**              | `otta new web` (SPA + admin)                                                             | `otta new worker` (single Worker, server-rendered + API)                            | A bare Worker without `ottabase/packages.ts` — loses every package      |
| **Package deps**           | `workspace:*` (internal) / `catalog:` (shared external)                                  | `peerDependency` for a shared package's framework dep                               | Package-local version of a shared dep — avoid                           |

## Notes

- **Lint is the enforcer, not just docs.** The `~~struck-through~~` "Possible" cells are actual ESLint errors (see
  `eslint.config.mjs` and `AGENTS.MD` → "Enforced by Lint"). If a rule looks wrong for your case, that's a discussion —
  not an `eslint-disable`.
- **The escape hatch is a feature, not a failure.** Dropping to a lower row is expected occasionally; the goal is that
  the _default_ is obvious and the _deviation_ is deliberate and visible in review.
- When two supported approaches have meaningfully different costs, the framework should say so (principle #13) — prefer
  static CSS/reusable classes over per-element runtime styling for repeated UI.
