# Cloudflare Workers Deployment

CI/CD for deploying apps to Cloudflare Workers: automatic discovery, per-app config, PR previews, and production deploys
from `main`.

## Workflows

| Workflow               | Trigger                               | Purpose                                               |
| ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| **deploy.yml**         | Push to `main`; `workflow_dispatch`   | Build & deploy to production (change-based or forced) |
| **pr-preview.yml**     | Pull request (open/sync/reopen/close) | Build & deploy preview worker; cleanup on PR close    |
| **build-packages.yml** | Called by deploy + pr-preview         | Build shared packages and cache for downstream jobs   |
| **ci.yml**             | `workflow_dispatch`                   | Lint, type-check, test, build (no deploy)             |

**Target:** Cloudflare Workers only (not Pages). Deployed URLs: `https://<worker>-<env>.<subdomain>.workers.dev`.

## Quick Start

### Add a deployable app

1. In your app folder (e.g. `apps/my-app/`), add `cloudflare-config.json`:

```json
{
    "deployable": true,
    "appType": "tanstack"
}
```

2. Ensure `package.json` has a `build` script and (if needed) `wrangler.jsonc` exists.
3. Push to `main` → production deploy runs when that app (or `packages/`) has changes. Open a PR → preview deploy runs
   unless skipped.

### Existing apps

Already configured; push to `main` or open PRs as usual.

## Configuration

**Schema:** [schemas/cloudflare-config.schema.json](../schemas/cloudflare-config.schema.json)

### Main properties

| Property             | Default                            | Description                                                        |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `deployable`         | `true`                             | If `false`, app is skipped by discovery                            |
| `appType`            | `"tanstack"`                       | `tanstack`, `nextjs`, `react`, `remix`, `vite`, `custom`           |
| `workerName`         | package name                       | Worker name in Cloudflare                                          |
| `buildCommand`       | `"build"`                          | pnpm script for app build                                          |
| `workerBuildCommand` | `null`                             | pnpm script for Worker bundle (e.g. OpenNext); `null` for TanStack |
| `outputDirectory`    | `"dist"`                           | Dir to verify after build                                          |
| `verifyPaths`        | `["dist", "cloudflare-worker.ts"]` | Paths that must exist after build                                  |
| `wranglerConfig`     | `"wrangler.jsonc"`                 | Wrangler config file                                               |
| `requiresSecrets`    | `[]`                               | _(Optional)_ Extra secrets not in wrangler.jsonc (e.g. build-time) |

> **SSOT:** Placeholders in `wrangler.jsonc` `env.production` / `env.preview` are auto-detected. `requiresSecrets` is
> only for secrets that don't appear in wrangler.

### Minimal examples

**TanStack (default):**

```json
{ "deployable": true, "appType": "tanstack" }
```

**Next.js:**

```json
{
    "deployable": true,
    "appType": "nextjs",
    "workerBuildCommand": "build:worker",
    "outputDirectory": ".worker-next",
    "verifyPaths": [".worker-next", ".worker-next/assets"]
}
```

**Full (optional):**

```json
{
    "$schema": "../../schemas/cloudflare-config.schema.json",
    "deployable": true,
    "appType": "tanstack",
    "workerName": "my-app",
    "buildCommand": "build",
    "outputDirectory": "dist",
    "verifyPaths": ["dist", "cloudflare-worker.ts"],
    "wranglerConfig": "wrangler.jsonc"
}
```

### Wrangler placeholders

In `wrangler.jsonc`, `ALL_CAPS_SNAKE_CASE` placeholder values in `env.production` and `env.preview` are
**auto-detected** by `substitute-wrangler-secrets.py` and substituted from GitHub Secrets. No explicit key list or
per-secret workflow wiring needed — just set the placeholder and the secret.

**Default (env.production):** `D1_DATABASE_ID`, `KV_NAMESPACE_ID` **Default (env.preview):** `D1_PREVIEW_DATABASE_ID`,
`KV_PREVIEW_NAMESPACE_ID`

**Multi-app:** Same placeholder name across apps → same GitHub Secret → shared resource. Different names → isolated.
Prefixing (e.g. `APP_1_D1_DATABASE_ID`) is a convention for clarity, not a requirement.

Generated files: `wrangler.production.jsonc` / `wrangler.preview.jsonc` (gitignored).

## Secrets

**Settings → Secrets and variables → Actions**

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

| Secret                | Default                          | Purpose                                                                         |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `APPS_TO_DEPLOY`      | `ottabase-template-app-tanstack` | Comma-separated app names or folder names to deploy (production and PR preview) |
| `CF_WORKER_SUBDOMAIN` | `apiary`                         | Subdomain in `*.workers.dev` (e.g. `apiary` → `my-worker.apiary.workers.dev`)   |

## Production deploy (deploy.yml)

- **Triggers:** Push to `main`; or **Run workflow** with optional `FORCE_DEPLOY` (default `true` = deploy all target
  apps).
- **Change detection:** Only apps with changes (in that app or under `packages/`) are deployed unless `FORCE_DEPLOY` is
  true.
- **Skip:** If the commit message on `main` contains `#skipdeploy`, it is checked first (`check-skip-deploy` job); then
  `build-packages` and deploy are skipped, and `prepare-deployment` outputs an empty matrix. See
  [Skip deployment](#skip-deployment).

**Deploy logic** — `#skipdeploy` is checked first (`check-skip-deploy`). When not skipping, the following run in
`prepare-deployment`:

1. **Target apps** — From secret `APPS_TO_DEPLOY` or default (e.g. `ottabase-template-app-tanstack`).
2. **File change detection** — `CHANGED_FILES` (e.g. `git diff HEAD~1 HEAD`), then `PACKAGES_CHANGED` (any path under
   `packages/`), and `CHANGED_APP_FOLDERS` (app dirs with changed files).
3. **Per-app deploy decision** — `SHOULD_DEPLOY` = true if packages changed (deploy all target apps) or that app is in
   `CHANGED_APP_FOLDERS`; or if `FORCE_DEPLOY` is true on manual run.
4. **Matrix build** — For each app to deploy: load config, check `deployable`, build matrix JSON; output `matrix` and
   `has-apps` for the deploy job.

## PR preview (pr-preview.yml)

- **Triggers:** PR opened, synchronized, reopened, or closed.
- **Open/sync/reopen:** Builds packages, builds app(s), deploys preview worker(s) named e.g. `my-app-pr-123` using
  **env.preview** bindings (ottabase-db-preview D1, OBCF_KV_preview, ottabase-bucket-preview). Preview URL:
  `https://<preview-name>.<CF_WORKER_SUBDOMAIN>.workers.dev`.
- **Closed:** Deletes the preview worker (preview D1/KV persist; shared across PRs).
- **Skip:** If PR title or description contains `#skippr` or `#skipdeploy`, preview build and deploy are skipped. See
  [Skip deployment](#skip-deployment).

## Skip deployment

Use markers so PR preview or production deploy do not run when not needed (e.g. docs-only PRs).

| Marker        | Where                                        | Effect                            |
| ------------- | -------------------------------------------- | --------------------------------- |
| `#skippr`     | PR title or description                      | Skips PR preview build and deploy |
| `#skipdeploy` | PR title/description                         | Skips PR preview                  |
| `#skipdeploy` | Commit message on `main` (e.g. merge commit) | Skips production deploy           |

**Examples:**

- PR title: `Docs: fix typo #skippr` → no preview deploy.
- PR title: `Chore: deps #skipdeploy` → no preview; after merge, if merge commit message contains `#skipdeploy`, no
  production deploy.

## Build flow (per app type)

**TanStack:** `pnpm run build` → `dist/` + `cloudflare-worker.ts` → `wrangler deploy`.

**Next.js:** `pnpm run build` → `.next/`; then `pnpm run build:worker` (OpenNext) → `.worker-next/` → `wrangler deploy`.

## Local testing

```bash
# Discovery (matrix of deployable apps)
node .github/scripts/discover-deployable-apps.mjs

# Build and preview one app
cd apps/my-app
pnpm build
pnpm build:worker   # if Next.js
pnpm preview       # if available
```

## Troubleshooting

| Issue               | Check                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| App not discovered  | `deployable: true` in `cloudflare-config.json`; `package.json` has required scripts; `wrangler.jsonc` present if no cloudflare-config |
| Build fails         | Actions logs; locally: `pnpm --filter=@ottabase/my-app run build`                                                                     |
| Deploy fails        | Required secrets set; `wrangler.jsonc` valid; no unsubstituted placeholders in generated config                                       |
| Preview not created | PR without `#skippr` / `#skipdeploy`; secrets set; app in `APPS_TO_DEPLOY` or default                                                 |

Errors in workflows include what failed, why, and how to fix (e.g. missing secrets with links to Cloudflare).

## Files

```
.github/
├── workflows/
│   ├── deploy.yml           # Production deploy (main / manual)
│   ├── pr-preview.yml       # PR preview deploy + cleanup
│   ├── build-packages.yml   # Reusable: build packages
│   └── ci.yml               # Lint, type-check, test, build
├── scripts/
│   ├── discover-deployable-apps.mjs
│   └── substitute-wrangler-secrets.py   # Substitutes secrets into wrangler config
├── README.md                # This file
└── DEPLOYMENT.md            # Full reference (config, errors, extending)
```

**Full reference:** [DEPLOYMENT.md](DEPLOYMENT.md) — all config properties, framework examples, error messages,
extending the system.
