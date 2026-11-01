# Deploy Ottabase to Cloudflare Workers

Complete guide for deploying `otta-web` to Cloudflare Workers with automated CI/CD.

## Prerequisites

- Cloudflare account (free tier works)
- GitHub repository with Actions enabled
- Node.js 24+ and pnpm 10+ installed locally

## The short way: `otta deploy`

No GitHub needed for a first deploy, or for a one-person project:

```bash
pnpm cf:login
pnpm otta deploy my-app --owner-email me@example.com --owner-password '…'
```

That is Steps 1 to 6 below from one terminal: the resources the env block of `wrangler.jsonc` names are created, their
ids are filled into a gitignored `wrangler.production.jsonc`, the packages and the app are built and deployed, the
framework secrets are generated and set once (`AUTH_SECRET`, `MIGRATION_SECRET`, `BOOTSTRAP_OWNER_SECRET`,
`CRON_SECRET`, `AUTH_URL`), the database is bootstrapped with that owner, and `/api/health` is checked. Rerun it to
redeploy. Details and flags (`--env`, `--set`, `--url`, `--skip-build`): `packages/cli/README.md`, "Deploying straight
to Cloudflare". The rest of this guide is the CI/CD setup for a team.

### After that: one deploy, wherever it runs

The terminal, Cloudflare Workers Builds and GitHub Actions all run the same `otta deploy`; how each app builds and ships
is its `cloudflare-config.json`. The recommended setup:

- **Workers Builds deploys production on every push**, one connection per app: Workers & Pages, Create, Import a
  repository; Worker named as the env names it (`otta-web-production`), root directory `/`, deploy command
  `pnpm otta deploy otta-web --ci`, the env block's placeholder values (`CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`,
  `KV_NAMESPACE_ID`) as build variables, build watch paths from `pnpm otta deploy otta-web --watch-paths`, and **Enable
  Preview Builds** unticked (their default command runs wrangler on the unfilled template).
- **GitHub runs the tests** (`ci.yml`) as required checks on `main`, so Workers Builds deploys only tested code.
- **GitHub's `deploy.yml` is manual**: the fallback. `pr-preview.yml` makes PR previews on request.

One automatic deployer per Worker, never both. `--ci` creates nothing and sets no secret: run the first deploy from a
terminal, or set the secrets by hand. The whole setup, every flag and every failure message:
[`.github/DEPLOYMENT.md`](../.github/DEPLOYMENT.md).

Both `otta deploy` and the CI workflow tag each deploy with the short commit (`wrangler deploy --tag abc1234`). The
Worker reads it back through its version metadata binding (`OBCF_VERSION` in `wrangler.jsonc`), so the `/admin`
readiness line and the Fleet report say which build is running. Outside a git checkout `otta deploy` deploys untagged.

---

## Step 1: Setup Cloudflare Resources

### Install Wrangler & Login

```bash
npm install -g wrangler
wrangler login
# Or use project auth: pnpm cf:login
```

### Create Resources (Automated)

```bash
pnpm cf:login   # If not authenticated (required before cf:setup)
pnpm cf:setup   # Interactive: select D1, KV, R2, Queue (use --force for all)
pnpm cf:validate
```

---

**What cf:setup creates:**

- D1 Database: `ottabase-db`
- KV Namespace: `OBCF_KV` (+ preview)
- R2 Buckets, one per kind of data (+ preview): `ottabase-bucket` (public files), `ottabase-files-private` (members and
  owner files, system artifacts), `ottabase-vault` (Vault backups). `otta deploy --env demo|staging` creates the `-demo`
  / `-staging` ones.
- Queue: `ottabase-queue` (+ preview)
- D1 preview database: `ottabase-db-preview`
- **Does NOT modify wrangler.jsonc** (it's a template). Its output IDs are the CI values below (`otta deploy` from a
  terminal runs it and fills them in itself).

**Resource overview (prod vs preview):**

| Resource | cf:setup creates (prod)                                 | cf:setup creates (preview) | wrangler placeholder (prod) | wrangler placeholder (preview)     | CI values                                |
| -------- | ------------------------------------------------------- | -------------------------- | --------------------------- | ---------------------------------- | ---------------------------------------- |
| D1       | ottabase-db                                             | ottabase-db-preview        | `D1_DATABASE_ID`            | `D1_PREVIEW_DATABASE_ID`           | D1_DATABASE_ID, D1_PREVIEW_DATABASE_ID   |
| KV       | OBCF_KV                                                 | OBCF_KV_preview            | `KV_NAMESPACE_ID`           | `KV_PREVIEW_NAMESPACE_ID`          | KV_NAMESPACE_ID, KV_PREVIEW_NAMESPACE_ID |
| R2       | ottabase-bucket, ottabase-files-private, ottabase-vault | the same with `-preview`   | the names (literal)         | the `-preview` names (literal)     | none                                     |
| Queue    | ottabase-queue                                          | ottabase-queue-preview     | `ottabase-queue` (literal)  | `ottabase-queue-preview` (literal) | none                                     |

D1 and KV placeholder values name the CI values (`otta deploy` finds them and fills in the ids). R2 and Queue use
literal names (nothing to fill).

---

## Step 2: Get Cloudflare Credentials

### Get Account ID

```bash
wrangler whoami
```

Or find it at: https://dash.cloudflare.com → Workers & Pages (right sidebar)

### Create API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"** → Use **"Edit Cloudflare Workers"** template
3. Ensure permissions include: Workers Scripts, KV Storage, D1, Queues (the deploy attaches the Worker as the queue's
   consumer), Account Settings
4. **Copy the token immediately** (shown only once)

### Get Resource IDs

Copy from **cf:setup output** (printed at the end), or run:

```bash
wrangler d1 list              # Get D1_DATABASE_ID
wrangler kv namespace list    # Get KV_NAMESPACE_ID
```

Note: `wrangler.jsonc` contains `ALL_CAPS_SNAKE_CASE` placeholder values that `otta deploy` finds and fills at deploy
time from the values of the same names. No explicit key list needed.

---

## Step 3: Give CI the values

The same names go where the deploy runs: **Workers Builds** (the recommended production deployer) takes the placeholders
as build variables (Worker → Settings → Build → Variables and secrets) and brings its own API token; **GitHub**
(`deploy.yml`, PR previews) takes them as repository secrets: Settings → **Secrets and variables** → **Actions** → **New
repository secret**.

**Production:**

| Secret Name             | Description                | Where to Get                                    |
| ----------------------- | -------------------------- | ----------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token (GitHub only)    | Step 2 above                                    |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID            | `wrangler whoami`                               |
| `D1_DATABASE_ID`        | Production D1 database ID  | cf:setup output or `wrangler d1 list`           |
| `KV_NAMESPACE_ID`       | Production KV namespace ID | cf:setup output or `wrangler kv namespace list` |

**PR preview (GitHub secrets; uses isolated preview D1/KV/R2):**

| Secret Name               | Description                      | Where to Get    |
| ------------------------- | -------------------------------- | --------------- |
| `D1_PREVIEW_DATABASE_ID`  | Preview D1 (ottabase-db-preview) | cf:setup output |
| `KV_PREVIEW_NAMESPACE_ID` | Preview KV (OBCF_KV_preview)     | cf:setup output |

> **Multi-app:** Same placeholder name across apps → same value → shared resource. Different names → isolated. Prefixing
> (e.g. `APP_1_D1_DATABASE_ID`) is a convention for clarity, not a requirement. Only 2 steps: set the placeholder in
> `wrangler.jsonc`, give CI a value of that name; `otta deploy` finds the rest. See
> [.github/DEPLOYMENT.md](../.github/DEPLOYMENT.md#values-placeholders-and-secrets) for a walkthrough.

---

## Step 4: Setup Database

CI does **not** run migrations. Schema is applied by OttaORM auto-migrations after the first deploy: open
`https://<your-worker>/__bootstrap__` and run the setup wizard (it applies the schema, seeds roles and creates the
platform owner; it asks for `BOOTSTRAP_OWNER_SECRET`), or call `POST /api/ottaorm/init` with `MIGRATION_SECRET` for
later schema changes. Set both secrets before deploying:

```bash
cd apps/otta-web
pnpm wrangler secret put BOOTSTRAP_OWNER_SECRET --env production
pnpm wrangler secret put MIGRATION_SECRET --env production
```

See [CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md#migration-not-applied) for the init call.

---

## Step 5: Deploy

### Trigger Deployment

**Option A - Workers Builds (recommended):** connect the app once (see "After that" at the top), then every push to
`main` deploys it. The build log is in Cloudflare → the Worker → Deployments.

**Option B - GitHub, manual:**

1. Go to GitHub → **Actions** tab
2. Select **"Deploy to Cloudflare Workers"**
3. Click **"Run workflow"** (`app` empty: every deployable app)

To deploy from GitHub on every push instead, uncomment `push:` in `.github/workflows/deploy.yml` (and leave Workers
Builds disconnected for that app).

### Monitor Deployment

Each run does, per app: the plan (what changed, `#skipdeploy`), the workspace packages, the app and its Worker bundle,
the `verifyPaths` check, `wrangler.production.jsonc` with the values filled in, the deploy (tagged with the commit), the
health check, and a summary (GitHub's job summary, or the log's last lines).

---

## Step 6: Verify Deployment

### Find Your Worker URL

```bash
wrangler deployments list --name otta-web
```

Or: https://dash.cloudflare.com → Workers & Pages → otta-web

### Test Your App

```bash
# Visit in browser
https://otta-web.your-subdomain.workers.dev

# Check logs
wrangler tail otta-web
```

### Files: the buckets, a domain for user content, the safe headers

Uploads live in three buckets, because a bucket is the unit of exposure (see `packages/ottaupload/README.md`):

| Binding           | Bucket (production)      | Holds                                            | Served                              |
| ----------------- | ------------------------ | ------------------------------------------------ | ----------------------------------- |
| `OBCF_R2`         | `ottabase-bucket`        | public files only (avatars, media, brand assets) | by key, ideally from its own domain |
| `OBCF_R2_PRIVATE` | `ottabase-files-private` | members/owner files, system artifacts            | never by key: `/api/files/:id` only |
| `OBCF_R2_VAULT`   | `ottabase-vault`         | Vault backups (every tenant's rows)              | never: no route reads it            |

`pnpm cf:setup` (and `otta deploy`) creates all three for the env. By hand:
`wrangler r2 bucket create ottabase-files-private` and `wrangler r2 bucket create ottabase-vault` (plus `-preview`,
`-demo`, `-staging` for those envs). Never give either private bucket a public domain or `r2.dev` access.

**Serve the public bucket from its own domain.** Out of the box, public files come through the Worker at
`/api/files/public/<key>`. In production give the public bucket an R2 custom domain and point `R2_PUBLIC_URL` at it:

1. **Use a separate registrable domain for user content**, e.g. `files.example-usercontent.com`, not a subdomain of the
   app's domain. A file a user uploaded then shares no cookies, no `document.domain` and no same-site trust with the
   app, which is what keeps an uploaded HTML or SVG from ever acting as the app.
2. R2 → `ottabase-bucket` → Settings → Custom Domains → connect `files.example-usercontent.com` (the zone must be on
   Cloudflare). Leave the `r2.dev` URL disabled. Without a custom domain, public URLs are
   `<AUTH_URL>/api/files/public/<key>`: the files service makes them absolute against `AUTH_URL`, so set it to the app's
   public origin (mail and social cards need full URLs).
3. Set the var in each env block of `wrangler.jsonc` (named envs do not inherit `vars`):
   `"R2_PUBLIC_URL": "https://files.example-usercontent.com"`. New uploads get URLs on that domain; avatars and brand
   logos are stored as keys, so they move with the setting. URLs pasted into content (blog posts, landing pages) keep
   the address they were picked with, and `/api/files/public/*` keeps serving them.
4. **Add the safe headers with a Transform Rule** on the files zone, since R2 serves the bucket directly there: Rules →
   Transform Rules → Modify Response Header, matching `http.host eq "files.example-usercontent.com"`, set
   `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox; default-src 'none'`. (Content-Type,
   Content-Disposition and Cache-Control come from each object's metadata, written at upload.)
5. **Turn on the CSAM Scanning Tool** for that zone (Caching → Configuration → CSAM Scanning Tool). It scans images
   served from the zone and blocks matches; it only sees traffic through Cloudflare, which a custom domain guarantees.

Also set, as secrets: `FILES_SIGNING_SECRET` (32+ random chars; signs `?t=` links to private files, which are refused
while it is unset) and, if 1024 MB per organization does not fit, the var `FILES_QUOTA_MB`. The Images binding
(`OBCF_IMAGES`, in every env block) makes the thumb/card/full WebP variants narrower than the original (each image
upload costs up to three transformations) and re-encodes AVIF uploads, whose metadata cannot be stripped in code;
without it AVIF is refused.

**Quarantine purges the edge cache when it can.** Public files are cached as immutable for a year, so quarantining one
(media library → Quarantine) moves it out of the public bucket and then purges its URLs: set the var
`CLOUDFLARE_FILES_ZONE_ID` (the files domain's zone) and the secret `CLOUDFLARE_PURGE_API_TOKEN` (a token with Zone →
Cache Purge on that zone). Without them the admin is shown the URLs to purge by hand (Caching → Configuration → Purge
Cache → Custom Purge).

**Uploads have their own rate limiter**, `OBCF_RATE_LIMITER_UPLOADS` (60 a minute per user, in every env block); a
production deploy without it refuses uploads.

### Turnstile: the bot check on public forms

Every form a stranger can submit (sign in, register, magic link, password reset, verification resend, protected post
unlock, anonymous comments, the landing lead form, and Pro's newsletter and status subscribe forms) checks for bots with
Cloudflare Turnstile. It is free, invisible for most people, and off until you turn it on.

1. Cloudflare dashboard → Turnstile → Add widget: mode **Managed**, hostnames = the app's domains (production and the
   demo; the landing site too if it is on another domain).
2. Paste the **site key** into `TURNSTILE_SITE_KEY` in each env block's `vars` in `wrangler.jsonc` (it is public; named
   envs do not inherit `vars`). Set the **secret key** per env:
   `wrangler secret put TURNSTILE_SECRET_KEY --env production`.
3. Do the same in `apps/otta-landing/wrangler.jsonc` if the landing site is deployed.

Checks run only when both keys are set, so a secret alone never locks the forms. Admin → System readiness shows both.
When Cloudflare cannot be reached, forms that mail an address or create something refuse with a 503, and password
sign-in goes through (logged) behind its rate limit. Preview and staging can use Cloudflare's test keys (site
`1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`), which pass on any hostname. Try it at
`/demo/cloudflare/turnstile`; `packages/cf/README.md` ("Turnstile") has the API for adding it to a new form. If a
Content-Security-Policy is added later, allow `https://challenges.cloudflare.com` in `script-src` and `frame-src`.

---

## Troubleshooting

### "Resource not found" errors

```bash
pnpm cf:setup
pnpm cf:validate
```

Then update the CI values (Workers Builds build variables, GitHub secrets) with the new IDs.

### "Unauthorized" or "Invalid API token"

Regenerate API token with correct permissions (Step 2).

### "Migration failed" errors

Inspect which tables exist, then re-run `POST /api/ottaorm/init` (it is idempotent: it only creates missing tables and
columns):

```bash
wrangler d1 execute ottabase-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Build fails

```bash
pnpm clean
rm -rf node_modules
pnpm install
```

---

## Quick Reference

### Essential Commands

```bash
# Local development
pnpm dev

# Deploy from your machine: the same deploy CI runs (fills the placeholders, builds, deploys)
pnpm otta deploy otta-web
pnpm otta deploy otta-web --ci --dry-run      # what CI would do, and which values it would miss

# View logs
wrangler tail otta-web

# Execute D1 commands
wrangler d1 execute ottabase-db --remote --command="SELECT * FROM users LIMIT 5"

# List resources
wrangler d1 list
wrangler kv namespace list
wrangler r2 bucket list
wrangler queues list
```

### CI/CD Workflow

Every deploy is `otta deploy`, wherever it runs: Workers Builds on push (`--ci`), `.github/workflows/deploy.yml` on
demand (`--all --plan`, then `--ci` per app), `pr-preview.yml` for previews (`--preview pr-<N>`):

1. Plan: which apps, and why (changed files, `#skipdeploy`, `deployable`)
2. Build the workspace packages the apps use, then each app and its Worker bundle
3. Check `verifyPaths`; fill `wrangler.production.jsonc` from the values
4. Deploy, tagged with the commit; health check; summary

Migrations are not part of CI — see Step 4.

### Turborepo Remote Cache

`apps/otta-cache` is a self-hosted Turborepo remote cache (Workers + R2). Every workflow exports `TURBO_API`,
`TURBO_TOKEN`, `TURBO_TEAM` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY`; when the secrets are absent (fork PRs) turbo
silently runs local-only. One-time setup, token format, rotation, and local use are in
[`apps/otta-cache/README.md`](../apps/otta-cache/README.md). Required GitHub Secrets: `TURBO_API`
(`https://otta-cache-production.<subdomain>.workers.dev`), `TURBO_TOKEN` (a read-write token),
`TURBO_REMOTE_CACHE_SIGNATURE_KEY` (any 32+ byte random string). Set `"deployable": true` in
`apps/otta-cache/cloudflare-config.json` so CI deploys it.

### Important Files

- `apps/otta-web/cloudflare-config.json` - the app's deploy manifest: how it builds, what the build must leave, its env,
  health path and previews (schema: `schemas/cloudflare-config.schema.json`)
- `apps/otta-web/wrangler.jsonc` - Cloudflare config (template with `ALL_CAPS` placeholder values; `otta deploy` writes
  wrangler.production.jsonc with them filled)
- `.github/DEPLOYMENT.md` - the deploy reference: Workers Builds, GitHub Actions, values, previews, markers, failures

### Cloudflare Bindings

| Binding             | Type           |
| ------------------- | -------------- |
| `OBCF_D1`           | D1 Database    |
| `OBCF_KV`           | KV Namespace   |
| `OBCF_R2`           | R2 Bucket      |
| `OBCF_R2_PRIVATE`   | R2 Bucket      |
| `OBCF_R2_VAULT`     | R2 Bucket      |
| `OBCF_IMAGES`       | Images         |
| `OBCF_QUEUE`        | Queue          |
| `OBCF_REALTIME`     | Durable Object |
| `OBCF_RATE_LIMITER` | Rate Limiter   |

See [CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md) for usage details.

---

## Setup Checklist

- [ ] Install wrangler: `npm install -g wrangler`
- [ ] Login: `wrangler login` or `pnpm cf:login`
- [ ] Create resources: `pnpm cf:setup` (its output IDs are the CI values); it creates all three R2 buckets
- [ ] Files: a custom domain on the public bucket (a separate registrable domain), `R2_PUBLIC_URL`, the Transform Rule,
      the CSAM Scanning Tool, `FILES_SIGNING_SECRET` (see "Files" above)
- [ ] Turnstile: a widget, `TURNSTILE_SITE_KEY` in each env's vars, `TURNSTILE_SECRET_KEY` as a secret (see "Turnstile"
      above)
- [ ] Validate: `pnpm cf:validate`
- [ ] First deploy from a terminal: `pnpm otta deploy otta-web --owner-email … --owner-password …`
- [ ] Workers Builds: connect the app, deploy command `pnpm otta deploy otta-web --ci`, build variables
      (CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, KV_NAMESPACE_ID), watch paths (`--watch-paths`), preview builds off
- [ ] GitHub: protect `main` with the `ci.yml` checks required
- [ ] GitHub Environments: `production` limited to `main` (reviewers optional), `preview` with required reviewers
- [ ] GitHub secrets for the manual deploy and previews (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, the production and
      preview placeholders)
- [ ] Push to main branch
- [ ] Verify deployment

**Done! Your app is deployed with full CI/CD.** 🚀

---

## Additional Resources

- **[CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md)** - Technical reference for bindings,
  environment variables, and code usage
- **[Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)** - Official documentation
- **[Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)** - Platform documentation
