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

All API failures use the framework `errorResponse()` contract. Client errors may include `fieldErrors` or safe
`metadata`; 5xx bodies remain opaque and carry only a stable code/request ID. Successful bootstrap responses and all
errors set `Cache-Control: no-store` because the payloads are secret-gated setup state. The owner-success response adds
`Set-Cookie` without weakening that cache policy.

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

## Writing for two audiences

The bootstrap is often someone's first hour with Cloudflare, and it is also run by people who deploy workers weekly. The
rule is **add plain language, never remove the identifier**. A binding row shows an icon, the human name (`Database`),
the exact value from `wrangler.jsonc` (`OBCF_D1`), the Cloudflare product (`D1`), one line on why the platform wants it,
and a status word beside the coloured dot. A newcomer reads left to right and understands; an operator reads the code
and the status and skips the rest.

The same shape applies elsewhere: step 2 lists every role next to what it can actually do, headings say what the step
gives you (`Decide who can do what`) rather than naming the mechanism, and each step explains itself before its button.
`BINDING_META` in `pages.ts` holds the per-binding copy; icons are inline Lucide paths in `ICON_PATHS`.

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

The palette, radius, shadow and motion tokens in `pages.ts` are transcribed from the **verdant** theme
(`packages/brand-engine/src/themes/verdant.json`, mirrored in `src/defaults.ts`), which is the framework default and is
what `ensureAppBrandDefaults` seeds as `themePresetId` during step two. The wizard therefore looks like the brand kit it
just created. The component CSS mirrors `@ottabase/ui-shadcn`: button `h-10` / `rounded-md`, input `h-10`, card
`rounded-lg` with a border, and the global `2px solid hsl(var(--ring))` focus ring.

Two values are not copied verbatim. Verdant's light `--muted-foreground` (`142 8% 46%`) measures 4.03:1 on its own
background and misses AA, so it is darkened to `142 8% 40%` (4.9:1). And `--danger` / `--success` / `--warning` are
derived from verdant's `destructive` / `success` / `warning`, which are button-fill values that fall well under 4.5:1 as
body copy; the hue is kept and the lightness dropped.

Verdant names Sora (headings) and Source Sans 3 (body), both served from Google Fonts. Bootstrap pages may not make
outbound requests, so those families are listed first in the stacks and are used only when already installed locally;
everyone else falls back to the system sans.

Light and dark default to `prefers-color-scheme`, and a toggle in the masthead overrides it. The choice is stamped as
`data-theme` on `<html>` and written to `localStorage` under **`ottabase.theme`** with the raw value `dark` or `light`,
which is exactly the key and value shape the app's `next-themes` provider uses (`ProviderNextThemes`, `storageKey`). A
scheme picked during setup therefore carries into `/login` and the rest of the app.

A small script in `<head>` reads that key before the stylesheet, mirroring the anti-FOUC script in
`apps/otta-web/index.html`, so a stored choice never flashes the system scheme first.

Two places clear client state, and both must keep this key. `KEEP` in the wizard script lists the harmless UI
preferences (`ottabase.theme`, `ottabase.language`, `ottabase.sidebar-state`, …) and `staleKeys()` filters against it.
The pre-owner-creation wipe goes through `staleKeys()` for exactly this reason: an unfiltered `ottabase.*` loop would
throw away the scheme the operator just chose.

The dark values live in the single `DARK_TOKENS` constant, interpolated into both
`@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` and `:root[data-theme='dark']`, so the toggle and
the system default cannot drift. A test asserts the tokens appear in exactly two places. The toggle's icon is swapped in
CSS rather than by script, so it is already correct on first paint.

Verdant sets `card` above `background` in both schemes (white on a tinted page in light, `9%` on `6%` in dark), so cards
read as raised without any lift of our own.

When changing the palette, keep every text/background pair at or above **4.5:1**. Measure rather than assume: render the
pages to a scratch directory and sample `getComputedStyle` in a browser. Current worst pair is 5.09:1 light, 5.20:1
dark.

## Tests

```bash
pnpm --filter @ottabase/otta-web exec vitest run worker/bootstrap
```
