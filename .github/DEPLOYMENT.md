# Cloudflare Workers Deployment

This is the complete reference for the deployment system: workflow behavior, quick start, secrets, configuration,
deployment internals, troubleshooting, nuances and extension points.

## Workflows

| Workflow               | Trigger                                               | Purpose                                               |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| **deploy.yml**         | Push to `main`; `workflow_dispatch`                   | Build & deploy to production (change-based or forced) |
| **pr-preview.yml**     | Pull request (open/sync/reopen/close)                 | Build & deploy preview worker; cleanup on PR close    |
| **build-packages.yml** | Called by deploy + pr-preview                         | Build shared packages and cache for downstream jobs   |
| **ci.yml**             | Pull request to `main`/`develop`; `workflow_dispatch` | Lint, type-check, test, build (no deploy)             |

**Target:** Cloudflare Workers only (not Pages). Production URLs: `https://<worker>.<subdomain>.workers.dev`. Preview
URLs use an explicit `--name` override (for example `my-app-pr-1234`) so no `-preview` suffix is appended.

## Quick Start

### Add a deployable app

1. In your app folder (for example `apps/my-app/`), add `cloudflare-config.json`:

```json
{
    "deployable": true,
    "appType": "vite"
}
```

1. Ensure `package.json` has a `build` script and, if needed, `wrangler.jsonc` exists.
1. Push to `main` and the production deploy runs when that app or `packages/` changes. Open a PR and preview deploy runs
   unless skipped.

### Existing apps

Already configured; push to `main` or open PRs as usual.

## Secrets

### Where to add secrets

Settings → Secrets and variables → Actions

### Required for production deploy

| Secret                  | Where to get it                      |
| ----------------------- | ------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages         |
| `D1_DATABASE_ID`        | `pnpm cf:setup` output (ottabase-db) |
| `KV_NAMESPACE_ID`       | `pnpm cf:setup` output (OBCF_KV)     |

### Required for PR preview deploy

| Secret                    | Where to get it                              |
| ------------------------- | -------------------------------------------- |
| `D1_PREVIEW_DATABASE_ID`  | `pnpm cf:setup` output (ottabase-db-preview) |
| `KV_PREVIEW_NAMESPACE_ID` | `pnpm cf:setup` output (OBCF_KV_preview)     |

PR preview uses isolated preview D1/KV/R2 so production data is never touched.

### Optional

| Secret                | Default                 | Purpose                                                                              |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `APPS_TO_DEPLOY`      | `otta-web,otta-landing` | Comma-separated app names or folder names to deploy (production and PR preview)      |
| `CF_WORKER_SUBDOMAIN` | `apiary`                | Subdomain in `*.workers.dev` (for example `apiary` → `my-worker.apiary.workers.dev`) |

## Production Deploy

- **Triggers:** Push to `main`; or **Run workflow** with optional `FORCE_DEPLOY` (default `true` = deploy all target
  apps).
- **Change detection:** Only apps with changes in that app or under `packages/` are deployed unless `FORCE_DEPLOY` is
  true.
- **Skip:** If the commit message on `main` contains `#skipdeploy`, it is checked first (`check-skip-deploy` job); then
  `build-packages` and deploy are skipped, and `prepare-deployment` outputs an empty matrix. See
  [Skip Deployment](#skip-deployment).

## PR Preview

- **Triggers:** PR opened, synchronized, reopened, closed, or manual **Run workflow**.
- **Open/sync/reopen:** Builds packages, builds app(s), deploys preview worker(s) named for example `my-app-pr-123`
  using **env.preview** bindings. Preview URL: `https://<preview-name>.<CF_WORKER_SUBDOMAIN>.workers.dev`.
- **Closed:** Deletes the preview worker. Preview D1/KV persist and can be shared across PRs.
- **Opt-in:** Preview deploy runs only when PR title or description contains `#deploy` or `#preview`, or when manually
  dispatched from Actions. If `pr_number` is provided on manual run, worker naming and cleanup align with that PR.

## Skip Deployment

Use markers so PR preview or production deploy do not run when not needed, such as docs-only changes.

| Marker        | Where                                               | Effect                              |
| ------------- | --------------------------------------------------- | ----------------------------------- |
| `#deploy`     | PR title or description                             | Enables PR preview build and deploy |
| `#preview`    | PR title or description                             | Enables PR preview build and deploy |
| `#skipdeploy` | Commit message on `main` (for example merge commit) | Skips production deploy             |

**Examples:**

- PR title: `Feature: blog editor #preview` → preview deploy runs.
- PR title: `Fix: auth callback #deploy` → preview deploy runs.
- PR title: `Docs: typo fix` → no preview deploy unless manually dispatched.
- Merge commit message on `main`: `Release patch #skipdeploy` → production deploy is skipped.

## Configuration Properties

| Property             | Type     | Default                            | Description                                                        |
| -------------------- | -------- | ---------------------------------- | ------------------------------------------------------------------ |
| `deployable`         | boolean  | `true`                             | Whether to deploy this app                                         |
| `appType`            | string   | `"vite"`                           | App framework (`vite`, `nextjs`, `react`, `remix`, `custom`)       |
| `workerName`         | string   | package name                       | Cloudflare Worker name                                             |
| `buildCommand`       | string   | `"build"`                          | pnpm script to build app                                           |
| `workerBuildCommand` | string   | `null`                             | pnpm script to build Worker bundle (null for Vite)                 |
| `outputDirectory`    | string   | `"dist"`                           | Worker output directory                                            |
| `assetsDirectory`    | string   | -                                  | Static assets directory                                            |
| `verifyPaths`        | string[] | `["dist", "cloudflare-worker.ts"]` | Paths to verify after build                                        |
| `wranglerConfig`     | string   | `"wrangler.jsonc"`                 | Wrangler config file path                                          |
| `wranglerEnv`        | string   | `"production"`                     | Wrangler environment                                               |
| `healthCheckPath`    | string   | `"/"`                              | Path for health check                                              |
| `requiresSecrets`    | string[] | `[]`                               | _(Optional)_ Extra secrets not in wrangler.jsonc (e.g. build-time) |

> **SSOT:** `wrangler.jsonc` is the single source of truth for resource secrets. Placeholders in `env.production` /
> `env.preview` are auto-detected by the substitution script. `requiresSecrets` is optional and additive — only needed
> for secrets that don't appear in wrangler (e.g. build-time env vars). Base secrets (`CLOUDFLARE_API_TOKEN`,
> `CLOUDFLARE_ACCOUNT_ID`) are always verified automatically.

## Framework Examples

### Vite (Default)

**package.json:**

```json
{
    "scripts": {
        "build": "vite build"
    }
}
```

**cloudflare-config.json:**

```json
{
    "deployable": true,
    "appType": "vite",
    "workerName": "my-neo-app",
    "buildCommand": "build",
    "workerBuildCommand": null,
    "outputDirectory": "dist",
    "verifyPaths": ["dist", "cloudflare-worker.ts"]
}
```

### Next.js with OpenNext

**package.json:**

```json
{
    "scripts": {
        "build": "next build",
        "build:worker": "node ./scripts/ensure-opennext-dirs.mjs && opennextjs-cloudflare build --skipBuild"
    }
}
```

**cloudflare-config.json:**

```json
{
    "deployable": true,
    "appType": "nextjs",
    "buildCommand": "build",
    "workerBuildCommand": "build:worker",
    "outputDirectory": ".open-next",
    "verifyPaths": [".open-next"]
}
```

### React/Vite

**package.json:**

```json
{
    "scripts": {
        "build": "vite build"
    }
}
```

**cloudflare-config.json:**

```json
{
    "deployable": true,
    "appType": "vite",
    "outputDirectory": "dist",
    "verifyPaths": ["dist"],
    "workerBuildCommand": ""
}
```

### Remix

**package.json:**

```json
{
    "scripts": {
        "build": "remix build"
    }
}
```

**cloudflare-config.json:**

```json
{
    "deployable": true,
    "appType": "remix",
    "outputDirectory": "build/client",
    "verifyPaths": ["build/client", "build/server"]
}
```

## Discovery Script

**Location:** `.github/scripts/discover-deployable-apps.mjs`

**How it works:**

1. Scans all directories in `apps/`
2. Checks for `package.json`
3. Looks for `cloudflare-config.json`:
    - Found: Uses custom config merged with defaults
    - Not found: Uses defaults if `wrangler.jsonc` exists
4. Verifies required build scripts exist
5. Skips if `deployable: false`
6. Outputs GitHub Actions matrix JSON

**Run locally:**

```bash
node .github/scripts/discover-deployable-apps.mjs
```

**Output format:**

```json
{
    "include": [
        {
            "name": "@ottabase/my-app",
            "folder": "my-app",
            "config": {
                /* full config */
            }
        }
    ]
}
```

## Deployment Workflow Steps

### Job 1: Prepare deployment (5 min timeout)

1. Checkout code (full history — needed for `github.event.before..github.sha` push-range diff)
2. Setup Node.js
3. Read `APPS_TO_DEPLOY` secret (or use default)
4. Detect changed files using the full push range; `PACKAGES_CHANGED=true` if `packages/`, root config files
   (`pnpm-lock.yaml`, `turbo.json`, etc.), first push, or `FORCE_DEPLOY`
5. Resolve each app’s folder + load its `cloudflare-config.json`

    > **Manual deploy (`workflow_dispatch`) note:** `FORCE_DEPLOY` defaults to `true`, so a manual run always deploys
    > all apps in `APPS_TO_DEPLOY`. This is intentional — manual triggers are typically used when you need everything
    > out now. To deploy a single app manually, set `FORCE_DEPLOY` to `false` and ensure only that app is listed in
    > `APPS_TO_DEPLOY` (or pass a scoped override via the input field).

6. Build and output matrix JSON for the deploy job

### Job 2: Deploy (20 min timeout, per app matrix entry)

1. **Load Configuration** - Parse app config from matrix
2. **Verify Secrets** - Check all required secrets exist
3. **Setup Environment** - Install pnpm, Node.js, dependencies
4. **Restore Caches** - Restore pre-built packages (from `build-packages` job) + Turborepo + framework caches
5. **Build App** - `pnpm --filter=<app> run <buildCommand>`
6. **Verify App Build** - Check expected outputs exist
7. **Build Worker** - `pnpm run <workerBuildCommand>`
8. **Verify Worker Bundle** - Check all `verifyPaths` exist
9. **Generate Wrangler Config** - Substitute production secrets
10. **Deploy** - `wrangler deploy --env production`
11. **Health Check** - Verify deployment accessible (3 retries)
12. **Summary** - Report status

## Wrangler Configuration

The workflow generates `wrangler.production.jsonc` (or `wrangler.preview.jsonc` for PR preview) by running
`.github/scripts/substitute-wrangler-secrets.py` **before** any wrangler deploy command. Order: Build → Generate config
(substitute secrets) → Verify → Deploy. The `cloudflare/wrangler-action` deploy step uses
`--config wrangler.production.jsonc` (or `wrangler.preview.jsonc`). Build steps do not use wrangler config.

**Convention:** Placeholder values in `wrangler.jsonc` are `ALL_CAPS_SNAKE_CASE` strings (e.g. `D1_DATABASE_ID`). The
substitution script **auto-detects** these from the target `env.production` or `env.preview` section and substitutes
each from the full GitHub Secrets bag (`${{ toJson(secrets) }}`). No key list, no per-secret env wiring, no mapping
table.

**Source (wrangler.jsonc env.production):**

```jsonc
{
    "d1_databases": [
        {
            "database_id": "D1_DATABASE_ID", // placeholder = GitHub Secret name
        },
    ],
}
```

**Generated (wrangler.production.jsonc):**

```jsonc
{
    "d1_databases": [
        {
            "database_id": "abc123...", // ← substituted from GitHub Secret
        },
    ],
}
```

**Default placeholders:**

- env.production: `D1_DATABASE_ID`, `KV_NAMESPACE_ID`
- env.preview: `D1_PREVIEW_DATABASE_ID`, `KV_PREVIEW_NAMESPACE_ID`

**Multi-app:** Same placeholder name across apps → same GitHub Secret → shared resource. Different names → isolated.
Prefixing (e.g. `APP_1_D1_DATABASE_ID`) is a convention for clarity, not a requirement.

To add a new resource placeholder: set the GitHub Secret name as the value in `wrangler.jsonc` env section, add the
secret to GitHub. That's it — the script auto-detects and substitutes.

`requiresSecrets` / `requiresPreviewSecrets` in `cloudflare-config.json` are **optional** and **additive** — used only
for early fail-fast verification. The Verify step **derives** placeholders from `wrangler.jsonc` (single source of
truth), then merges with base secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) and any extra from
`requiresSecrets`. No drift: wrangler placeholders are always correct. Add `requiresSecrets` only for secrets not in
wrangler (e.g. build-time).

## Error Messages Reference

### Missing Secrets

```text
❌ ERROR: Missing required GitHub secrets for deployment

The following secrets are required but not configured:
  • CLOUDFLARE_API_TOKEN
  • D1_DATABASE_ID

To fix this, add the missing secrets in GitHub repository settings:
  Settings → Secrets and variables → Actions → New repository secret

Required secret locations:
  • CLOUDFLARE_API_TOKEN: Get from Cloudflare dashboard → My Profile → API Tokens
  • CLOUDFLARE_ACCOUNT_ID: Get from Cloudflare dashboard → Workers & Pages → Account ID
  • D1_DATABASE_ID: Run 'wrangler d1 create <name>' to create database
  • KV_NAMESPACE_ID: Run 'wrangler kv:namespace create <name>' to create namespace
```

### Build Failure

```text
❌ ERROR: Application build failed

The 'build' command failed for @ottabase/my-app
Check the build output above for specific error messages.
```

### Next.js Build Missing

```text
❌ ERROR: Next.js build output not found

Expected directory 'apps/my-app/.next' was not created.
This indicates the Next.js build did not complete successfully.
```

### Worker Build Failure

```text
❌ ERROR: Cloudflare Worker build failed

The 'build:worker' command failed.
This command converts the Next.js build to a Cloudflare Worker using OpenNext.
Common issues:
  • Missing @opennextjs/cloudflare package
  • Invalid open-next.config.ts configuration
  • Missing .next directory (Next.js build must run first)
```

### Missing Worker Output

```text
❌ ERROR: Required paths not found after Worker build

The following paths were expected but are missing:
  • .open-next/

For Next.js apps using OpenNext, the expected output is:
  • .open-next/ - Main worker output directory (produced by opennextjs-cloudflare)

This error usually means:
  1. The 'build:worker' command didn't complete successfully
  2. OpenNext configuration (open-next.config.ts) is incorrect
  3. The Next.js build (.next directory) is missing

Current directory contents:
[listing shown]
```

### Wrangler Config Missing

```text
❌ ERROR: Wrangler configuration file not found

Expected file: wrangler.jsonc
Current directory: /home/runner/work/ottabase/ottabase/apps/my-app

Wrangler config is required for Cloudflare Workers deployment.
Make sure your app has a wrangler.jsonc file in its root directory.
```

### Secret Substitution Failed

From `.github/scripts/substitute-wrangler-secrets.py`:

```text
❌ ERROR: Secret substitution incomplete

  Placeholders detected in env.production but no matching GitHub Secret:
    • D1_DATABASE_ID

  Add the missing secrets in GitHub repository settings:
  Settings → Secrets and variables → Actions → New repository secret
```

## Deployment Targets

- ✅ **Cloudflare Workers** - Uses `wrangler deploy`
- ❌ **Cloudflare Pages** - NOT supported

Worker deployment indicators:

- Uses `main` entry point in wrangler.jsonc
- Uses Worker bindings (D1, KV, Durable Objects, etc.)
- Deploys to `https://<worker>.<account>.workers.dev`
- NOT `wrangler pages deploy`

## File Structure

```text
ottabase/
├── .github/
│   ├── scripts/
│   │   ├── discover-deployable-apps.mjs  # Local utility (not used by workflows)
│   │   └── substitute-wrangler-secrets.py  # Substitutes secrets into wrangler config
│   ├── workflows/
│   │   ├── deploy.yml           # Production deploy (main / manual)
│   │   ├── pr-preview.yml       # PR preview deploy + cleanup
│   │   ├── build-packages.yml   # Shared package build + cache
│   │   └── ci.yml               # Lint, type-check, test, build (on PR)
│   └── DEPLOYMENT.md                  # This file
│
├── schemas/
│   └── cloudflare-config.schema.json  # JSON schema
│
└── apps/
    └── my-app/
        ├── cloudflare-config.json     # Deployment config
        ├── wrangler.jsonc             # Cloudflare config
        ├── package.json               # Build scripts
        └── open-next.config.ts        # OpenNext config (Next.js only)
```

## Extending the System

### Add Custom Secrets or a Second App

The substitution script auto-detects `ALL_CAPS_SNAKE_CASE` placeholder values from the target `env` section in
`wrangler.jsonc` and substitutes them from GitHub Secrets. You never edit the Python script or the workflow files. There
are only **2 places** to update:

#### Example: Adding `APP_1` with its own isolated D1 database

**1. `wrangler.jsonc`** — use the secret name as the placeholder value:

```jsonc
// apps/app-1/wrangler.jsonc → env.production
"d1_databases": [{
    "binding": "OBCF_D1",
    "database_name": "app1-db",
    "database_id": "APP_1_D1_DATABASE_ID"  // ← auto-detected as placeholder
}]
```

**2. GitHub repo → Settings → Secrets** — add `APP_1_D1_DATABASE_ID` with the actual D1 UUID.

Done. No workflow edits, no `cloudflare-config.json` edits, no Python script edits.

> **Sharing rule:** If two apps both use `D1_DATABASE_ID` as their placeholder, they resolve to the same GitHub Secret →
> same database. If App 1 uses `APP_1_D1_DATABASE_ID`, it gets its own isolated resource. Just naming.

#### Optional: Early verification

Add secret names to `requiresSecrets` in `cloudflare-config.json` for fail-fast checking **before** the build runs. This
is optional — if omitted, missing secrets are caught later at substitution time.

### Add New App Type

**1. Create config:**

```json
{
    "appType": "svelte",
    "buildCommand": "build",
    "outputDirectory": "build",
    "verifyPaths": ["build"]
}
```

**2. Add framework-specific caching (optional):**

Edit workflow's cache step to add framework-specific cache paths.

### Disable Deployment Temporarily

```json
{
    "deployable": false,
    "appType": "nextjs"
}
```

App will be skipped during discovery.

## CI/CD Best Practices

1. **Test locally first** - Always test builds locally before pushing
2. **Use the schema** - Let VSCode validate your config
3. **Check the logs** - GitHub Actions logs show detailed error messages
4. **Verify secrets** - Ensure all required secrets are configured
5. **Health checks** - Deployment succeeds even if health check warns (allows propagation time)
6. **Small changes** - Test with small changes before big deployments
7. **Monitor first deploy** - Watch the full workflow run for new apps

## Comparison: Before vs After

| Feature           | Before                  | After                 |
| ----------------- | ----------------------- | --------------------- |
| App discovery     | Manual list in workflow | Automatic             |
| Configuration     | Hardcoded               | Per-app with defaults |
| Adding apps       | Edit workflow file      | Add config file       |
| Framework support | Next.js only            | Multi-framework       |
| Error messages    | Generic                 | Detailed with fixes   |
| Deployment target | Workers                 | Workers (explicit)    |
