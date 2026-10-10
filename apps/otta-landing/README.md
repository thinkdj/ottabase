# Ottabase Landing

The public marketing site, served by Next.js 16 on Cloudflare Workers through OpenNext. It renders the landing content
that otta-web's admin manages, reading it from the **same D1 database**. This app has no content of its own and never
writes.

```text
otta-web  /admin/content/landing  ──writes──▶  D1 (landing_sites, landing_pages)  ◀──reads──  otta-landing
```

The content model, the three themes (Launch, Editorial, Bold) and the renderer live in
[`@ottabase/ottalanding`](../../packages/ottalanding/README.md). This app is the thin shell around them:

```text
app/layout.tsx             reads the site; server-renders the theme tokens (light + dark) + fonts, and applies the
                           visitor's saved light/dark choice before first paint (no flash)
app/[[...slug]]/page.tsx   reads the published page at the path; renders it with <LandingView>
app/not-found.tsx          a real 404, drawn in the site's own theme and navigation
app/setup-notice.tsx       shown until otta-web has created the tables and starter content
lib/content.ts             connects OttaORM to the shared D1 and reads (cached per request)
```

## Quick start (local)

```bash
pnpm install
pnpm otta start otta-web                                # admin + API on :3003 / :3004
curl -X POST http://localhost:3004/api/ottaorm/init     # once: creates the tables, seeds a starter site
pnpm otta start otta-landing                            # the public site on :3000
```

Edit the site at `http://localhost:3003/admin/content/landing` (platform admin). Saved changes show on the next request
to `:3000`, because every request reads the current content.

## Database

Both apps bind `OBCF_D1` to the same database. Keep the `d1_databases` blocks in `wrangler.jsonc` identical to
`apps/otta-web/wrangler.jsonc`.

- **Locally:** `next.config.js` points the Cloudflare dev proxy at `../otta-web/.wrangler/state/v3`, and the binding
  uses `preview_database_id: "preview"` (the id wrangler keys local D1 files by). `next dev` here and `wrangler dev` in
  otta-web therefore open the same SQLite file.
- **Deployed:** each environment uses the same database-id placeholder as otta-web (`D1_DATABASE_ID`,
  `D1_PREVIEW_DATABASE_ID`, …), so CI substitutes the same real database.
- **`APP_ID`** (a wrangler var, default `otta-web`) selects whose landing content to show. It must match otta-web's
  `config.appId`.

Schema changes go through otta-web's migrations (`/api/ottaorm/init`). This app never migrates.

Bindings are typed in `cloudflare-env.d.ts` (the file `pnpm cf-typegen` writes). Keep it in step with `wrangler.jsonc`.

## SEO

- **Indexing:** only the deployment whose `ENVIRONMENT` var is `production` sends `index, follow`. Preview, staging and
  local deployments send `noindex, nofollow`, so copies never compete with the real site.
- **Canonical and Open Graph:** the site's **Public URL** (admin → Landing site → Site settings) becomes `metadataBase`,
  and each page gets a canonical URL plus Open Graph tags (`title`, `description`, `siteName`, `url`). Without a public
  URL the absolute URLs are omitted rather than guessed.

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Dev server                           |
| `pnpm build`         | Production Next.js build             |
| `pnpm build:worker`  | Build OpenNext Cloudflare worker     |
| `pnpm start`         | Start production server locally      |
| `pnpm preview`       | Build + run on local `workerd`       |
| `pnpm deploy`        | Build + deploy to Cloudflare Workers |
| `pnpm lint`          | ESLint                               |
| `pnpm type-check`    | TypeScript validation                |
| `pnpm test`          | Run tests                            |
| `pnpm test:coverage` | Run tests with coverage              |

From the repo root, `pnpm otta start otta-landing` is the canonical development entry point. Use `--env preview`,
`--env staging` or `--env production` to build OpenNext and start that Wrangler environment locally, and `--skip-build`
to reuse existing `.open-next` output.

Native Windows supports the Next.js development topology. OpenNext's Worker packager needs symlinks, so use WSL/Linux
for the Cloudflare-shaped `preview`, `staging` and `production` starts. CI already runs on Linux.

## Deployment

```bash
pnpm deploy
```

CI/CD is handled by the shared `.github/workflows/deploy.yml` — deploys on push to `main` with smart change detection
(only re-deploys when this app or shared packages change).

**Config-driven - no yml editing needed when renaming the app:**

1. Update `cloudflare-config.json` `workerName` and `wrangler.jsonc` `name` to match your new app name.
2. Set the `APPS_TO_DEPLOY` GitHub secret to a comma-separated list of app folder names, e.g. `main-app,homepage-app`.
3. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets.

The workflow reads `cloudflare-config.json` from each app folder to determine app type (`nextjs`), build commands,
output paths and wrangler config — no hardcoded names in yml.
