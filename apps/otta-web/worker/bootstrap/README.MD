# Bootstrap

First-run setup for a fresh Ottabase deployment. Everything under `/__bootstrap__` is served directly by the worker
before the database exists, so these pages are **fully self-contained** — inline CSS and JS, no asset pipeline, no
network requests.

## Routes

| Route                             | Method | Purpose                                                     |
| --------------------------------- | ------ | ----------------------------------------------------------- |
| `/__bootstrap__`                  | GET    | Setup wizard                                                |
| `/__bootstrap__/seed`             | GET    | Reconcile built-in roles (maintenance)                      |
| `/__bootstrap__/promote-owner`    | GET    | Grant `platform_owner` to an existing account (break-glass) |
| `/__bootstrap__/api/status`       | GET    | Platform state, bindings, table/role/user counts, env hints |
| `/__bootstrap__/api/init`         | POST   | Wipe `OBCF_KV`, create tables, run migrations               |
| `/__bootstrap__/api/seed`         | POST   | Seed and heal RBAC roles + default brand kit                |
| `/__bootstrap__/api/create-owner` | POST   | Create the first platform owner (once only, claim-guarded)  |
| `/__bootstrap__/api/finalize`     | POST   | Verify, then mark the platform `READY`                      |

Every endpoint is gated by `BOOTSTRAP_OWNER_SECRET` via the `X-Bootstrap-Secret` header. The GET pages also accept
`?secret=`, which the wizard reads into its token field. Failed attempts are rate-limited (`enforceBruteForceThrottle`).

Environment checks all go through `isDevEnvironment()` in `types.ts`, which allowlists `development`, `dev`, `test` and
`local`. Anything else — including an **unset** `ENVIRONMENT` — is treated as production: without a valid token those
deployments get the "setup token required" page instead of the wizard, and `/api/status` returns state only.

`POST /api/init` clears the entire KV namespace and drops the platform back to `BOOTSTRAPPING`. On a platform that is
already `READY` it refuses with `409 ALREADY_READY` unless called with `?confirm=reinit`; the wizard never sends that,
so a re-init is deliberate and curl-only.

```bash
SECRET=$(grep BOOTSTRAP_OWNER_SECRET apps/otta-web/.env.local | cut -d= -f2)
curl -s -X POST http://localhost:3004/__bootstrap__/api/init -H "X-Bootstrap-Secret: $SECRET"
```

## Files

| File                | Responsibility                                                       |
| ------------------- | -------------------------------------------------------------------- |
| `pages.ts`          | All seven rendered pages and the shared design system                |
| `routes.ts`         | Request handling, the secret gate, and the not-ready interceptor     |
| `state-resolver.ts` | Resolves `UNINITIALIZED` / `BOOTSTRAPPING` / `READY` (ENV > DB > KV) |
| `types.ts`          | State types, KV/meta keys, path constants                            |

## Wizard flow

Four steps, one action each, driven by a left rail that doubles as the progress indicator:

1. **Database** — probe bindings, then create tables and run migrations
2. **Roles** — seed the six built-in roles and their permissions
3. **Owner** — create the platform owner account (auto-signs the browser in)
4. **Launch** — pre-flight checks, then mark the platform `READY`

Reloading is safe. On load the wizard reads `/api/status` and lands on the first step that still has work, marking
completed steps done — it does not restart from step one. Reference material (Cloudflare CLI variables, production
environment variables) lives in disclosures next to the step it belongs to rather than occupying a step of its own.

## Design constraints

These are the rules that make the pages work at all — break them and setup breaks.

- **No external references.** No `<link rel="stylesheet">`, no `<script src>`, no webfonts, no remote images. The brand
  engine and asset pipeline do not exist yet. Tests assert this.
- **No backticks and no `${` inside the inline `<script>`.** The script lives in a TS template literal; use string
  concatenation. A test asserts no `${` survives into the rendered HTML.
- **Escape every interpolation** with `escapeHtml`. `state.reason` is env-derived and reaches the page as text.
- **Bind with listeners, not inline handlers** (`onclick=` etc.), so the pages stay compatible with a strict CSP.
- **Check `res.ok` before reading a response as success.** Error bodies are JSON too; a wrong token must surface on the
  token field, not as a confusing parse result.

## Look and feel

The palette, radius, shadow and motion tokens in `pages.ts` are transcribed from the app's default brand theme
(`packages/brand-engine/src/themes/default.json`) and the component CSS mirrors `@ottabase/ui-shadcn` — button `h-10` /
`rounded-md`, input `h-10`, card `rounded-lg` with a border, and the global `2px solid hsl(var(--ring))` focus ring.

Light and dark default to `prefers-color-scheme`, and a toggle in the masthead overrides it for the current page view.
The choice is stamped as `data-theme` on `<html>` and is **not persisted** — there is no theme store during bootstrap,
and step one asks the operator to clear this browser's saved state, so writing a key back would contradict it. A reload
returns to the system preference.

The dark values live in the single `DARK_TOKENS` constant, interpolated into both
`@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` and `:root[data-theme='dark']`, so the toggle and
the system default cannot drift. A test asserts the tokens appear in exactly two places. The toggle's icon is swapped in
CSS rather than by script, so it is already correct on first paint.

One deliberate deviation: in dark mode `--card` is lifted about 3% above `--background` and `--border` is raised to
`17.5%`. The app's theme sets dark `card == background`, which works inside app chrome but leaves these card-only pages
with no visible structure.

When changing the palette, keep every text/background pair at or above **4.5:1**. The status hues (`--danger`,
`--success`, `--warning`) are tuned for text on tinted surfaces, not for button fills.

## Tests

```bash
pnpm --filter @ottabase/otta-web exec vitest run worker/bootstrap
```
