# Deploying to Cloudflare Workers

The complete reference: the one deploy command, the app's deploy manifest, the three places it runs (a terminal,
Cloudflare Workers Builds, GitHub Actions), values and secrets, previews, markers and what each failure means.

## One deploy, three places it runs

Every deploy is `otta deploy` (`packages/cli`). A terminal, Workers Builds and GitHub Actions all run it, and differ
only in where values come from and what starts the run. Which apps deploy, how they build, what the build must leave,
the env and the health path come from each app's `cloudflare-config.json`; no workflow repeats any of it.

| Where                               | Starts on                       | Command                                       | Values come from                   |
| ----------------------------------- | ------------------------------- | --------------------------------------------- | ---------------------------------- |
| **Terminal**                        | You                             | `pnpm otta deploy <app>`                      | Your Cloudflare login (`cf:login`) |
| **Workers Builds** (Cloudflare)     | Push to the production branch   | `pnpm otta deploy <app> --ci`                 | Build variables                    |
| **GitHub Actions** `deploy.yml`     | Run workflow (manual)           | `otta deploy --all --plan`, then `<app> --ci` | Repository secrets                 |
| **GitHub Actions** `pr-preview.yml` | A PR with `#preview`, or manual | `otta deploy <app> --ci --preview pr-<N>`     | Repository secrets                 |
| **GitHub Actions** `ci.yml`         | Every PR                        | Lint, type-check, test, build; never deploys  | -                                  |

`build-packages.yml` is the shared package build GitHub's deploy jobs restore from (`--skip-packages`).

### The recommended setup

1. **Workers Builds deploys production automatically**, one connection per app. Cloudflare brings its own API token, the
   build log sits next to the Worker, and GitHub holds no Cloudflare credentials for production.
2. **GitHub runs the tests**: protect `main` (Settings → Branches → require a pull request and the `ci.yml` checks), so
   whatever reaches `main`, and so whatever Workers Builds deploys, has passed.
3. **`deploy.yml` stays manual**: the fallback, and the button that deploys everything now.
4. **`pr-preview.yml` makes PR previews**, opt-in.

**One automatic deployer per Worker, never two.** Both would deploy every push twice, possibly out of order. To deploy
from GitHub on every push instead, uncomment `push:` in `deploy.yml` and leave Workers Builds disconnected.

## The first deploy, from a terminal

```bash
pnpm cf:login
pnpm otta deploy otta-web --owner-email you@example.com --owner-password '…'
```

Creates the D1, KV, R2 and queue the env block names, fills `wrangler.production.jsonc` with their ids, builds, deploys,
generates and sets the framework secrets that are not set yet (`AUTH_SECRET`, `MIGRATION_SECRET`,
`BOOTSTRAP_OWNER_SECRET`, …, `AUTH_URL`) and bootstraps the database. Safe to run again. CI (`--ci`) creates nothing and
sets no secret, so this first run, or setting the secrets by hand, comes before any CI deploy. The ids it prints are the
values CI needs.

## The deploy manifest: `apps/<app>/cloudflare-config.json`

The one deploy file to edit, besides Cloudflare's own `wrangler.jsonc` (which keeps the Worker name and the bindings).
Every app Cloudflare deploys has one. It is read strictly: an unknown key or a wrong value stops the deploy and names
itself. Schema: `schemas/cloudflare-config.schema.json` (editors validate as you type).

| Key                      | Default                            | What it does                                                                                              |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `deployable`             | `true`                             | Whether CI deploys it (`--all`: Workers Builds, `deploy.yml`). `otta deploy <app>` deploys it either way. |
| `previewDeployable`      | `true`                             | Whether PR previews deploy a copy from its `env.preview` block                                            |
| `appType`                | `"vite"`                           | `vite`, `nextjs` or `custom`; only shapes the hints when a build leaves the wrong output                  |
| `buildCommand`           | `"build"`                          | The package.json script that builds the app                                                               |
| `workerBuildCommand`     | `null`                             | A second script that makes the Worker bundle (OpenNext's `build:worker`); null or `""`: none              |
| `verifyPaths`            | `["dist", "cloudflare-worker.ts"]` | Paths inside the app that must exist after the build; checked before wrangler runs                        |
| `wranglerConfig`         | `"wrangler.jsonc"`                 | The wrangler config in the app folder                                                                     |
| `wranglerEnv`            | `"production"`                     | The env block deployed when `--env` is not given                                                          |
| `healthCheckPath`        | `"/api/health"`                    | Requested after the deploy, four tries (10 s each); below 400 passes; a failure is reported, never fatal  |
| `requiresSecrets`        | `[]`                               | Build-time values beyond the placeholders (an upload token): checked before the build, handed to it       |
| `requiresPreviewSecrets` | `[]`                               | The same, for previews                                                                                    |

In this repository: `otta-web` and `otta-landing` are deployable; `otta-worker` (a template: `otta new worker` makes
apps from it, and they get `deployable: true`) and `otta-cache` (optional infrastructure) are not.

### Examples

**Vite** (otta-web): the defaults, plus its health path.

```json
{
    "$schema": "../../schemas/cloudflare-config.schema.json",
    "deployable": true,
    "appType": "vite",
    "healthCheckPath": "/api/health"
}
```

**Next.js with OpenNext** (otta-landing):

```json
{
    "$schema": "../../schemas/cloudflare-config.schema.json",
    "deployable": true,
    "appType": "nextjs",
    "buildCommand": "build",
    "workerBuildCommand": "build:worker",
    "verifyPaths": [".open-next"],
    "healthCheckPath": "/"
}
```

**A plain Worker** (otta-worker, otta-cache): `wrangler deploy --dry-run --outdir dist` as its build.

```json
{
    "$schema": "../../schemas/cloudflare-config.schema.json",
    "appType": "custom",
    "verifyPaths": ["dist/index.js"],
    "previewDeployable": false
}
```

## Values, placeholders and secrets

`wrangler.jsonc` names its resources with placeholders: an `ALL_CAPS_SNAKE_CASE` string where an id goes, in each env
block (`"database_id": "D1_DATABASE_ID"`). `otta deploy` finds them by itself and writes `wrangler.<env>.jsonc`
(gitignored) with the values filled in. It reads the file's syntax tree, so a commented-out line is never a placeholder,
and writes each value as a JSON string, so a quote or a backslash in a value cannot break the file. Names of things
(`binding`, `class_name`, `name`, `service`, `entrypoint`, `script_name`) are never placeholders.

| Placeholder (env.production) | Placeholder (env.preview) | Where the value comes from                    |
| ---------------------------- | ------------------------- | --------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`      | `CLOUDFLARE_ACCOUNT_ID`   | Cloudflare → Workers & Pages                  |
| `D1_DATABASE_ID`             | `D1_PREVIEW_DATABASE_ID`  | The first terminal deploy, or `pnpm cf:setup` |
| `KV_NAMESPACE_ID`            | `KV_PREVIEW_NAMESPACE_ID` | The same                                      |

In CI, a value is looked up in this order: `--set NAME=value`, `OTTA_DEPLOY_VALUES` (one JSON object), the environment.
Every missing name, placeholders and `requiresSecrets` together, is listed at once before anything builds:

```text
✗ No value for D1_DATABASE_ID, KV_NAMESPACE_ID (env.production of apps/otta-web). Set them in the CI's variables or secrets (or --set D1_DATABASE_ID=<value>).
```

**Same name, same resource.** CI's values are one bag for every app, so two apps using `D1_DATABASE_ID` deploy against
one database. `otta new` prefixes a new app's placeholders (`OTTABASE_MY_APP_D1_DATABASE_ID`, every one but
`CLOUDFLARE_ACCOUNT_ID`) and prints them; a landing app takes its web app's, on purpose. Adding a resource is: the
placeholder in `wrangler.jsonc`, the value in the CI. Nothing else.

**GitHub's secrets bag never reaches a build.** The workflows hand `otta deploy` all repository secrets as
`OTTA_DEPLOY_VALUES: ${{ toJson(secrets) }}`. The launcher (`packages/cli/bin/otta.mjs`) takes it out of the environment
before any module loads, `otta deploy` keeps only the placeholder names it needs, and no child process (pnpm, turbo,
vite, wrangler, any dependency's code) ever sees it. Wrangler gets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`,
passed on their own (wrangler reads the token from the environment only, so that is where it is checked).

**Build-time values: `requiresSecrets`.** A build that needs a value of its own (blackbox's source map upload in a
`postbuild` script needs `BLACKBOX_UPLOAD_TOKEN`; a Sentry release needs its token) names it in the manifest:

```json
{ "requiresSecrets": ["BLACKBOX_UPLOAD_TOKEN"] }
```

CI then checks it is there before anything builds, and hands exactly those names to the build scripts; no other value of
the secrets bag ever reaches them. In Workers Builds, set them as build variables (or secrets) like the placeholders.

## Cloudflare Workers Builds

Per app, in the Cloudflare dashboard: Workers & Pages → Create → Import a repository → this repository.

| Setting           | Value                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Worker name       | The name the env deploys: `otta-web-production` (wrangler's `name` plus `-<env>`)                                                     |
| Root directory    | `/`                                                                                                                                   |
| Build command     | empty                                                                                                                                 |
| Deploy command    | `pnpm otta deploy otta-web --ci`                                                                                                      |
| Preview builds    | Off: untick **Enable Preview Builds** (Settings → Build → Branch control). See below                                                  |
| API token         | The one Workers Builds creates with the connection                                                                                    |
| Build variables   | The env block's placeholders: `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `KV_NAMESPACE_ID`                                            |
| Build watch paths | Include: the output of `pnpm otta deploy otta-web --watch-paths`, or broadly `apps/otta-web/*`, `packages/*` and the root build files |

Workers Builds installs the dependencies itself (the lockfile picks pnpm, and Corepack runs the version in the root
`package.json`'s `packageManager`; Node comes from `.nvmrc`), then the deploy command builds the packages the app uses,
the app, and deploys. Wrangler authenticates with the API token Workers Builds created, so there is no
`CLOUDFLARE_API_TOKEN` to set, and `otta deploy` knows it runs there by `WORKERS_CI`. A build has 20 minutes and 8 GB of
memory (otta-web's build asks Node for 4 GB); the commit it tags the version with comes from `WORKERS_CI_COMMIT_SHA`
when git cannot tell.

**Why preview builds stay off.** On every branch but production, Workers Builds runs a separate Preview command,
`npx wrangler preview` by default (Cloudflare's Worker Previews). That is wrangler on the template config, whose env
placeholders only `otta deploy` fills, so those builds would fail or ship a broken preview. PR previews come from
`pr-preview.yml` instead.

**Watch paths are Workers Builds' syntax.** One `*` matches any characters, nested folders included (`apps/otta-web/*`);
excludes are applied first; a push of 20+ commits or 3000+ files always builds. `--watch-paths` prints exactly that
form.

**Watch paths live in the dashboard, not in git.** The precise list from `--watch-paths` goes stale when the app gains a
workspace dependency: a change to that package would then not rebuild the app. The broad list never misses a change, at
the cost of an occasional build nothing needed. Re-paste the precise one when dependencies change, or use the broad one.

**Split build and deploy** (optional): build command `pnpm otta deploy otta-web --ci --build-only`, deploy command
`pnpm otta deploy otta-web --ci --skip-build`.

## Version URLs: off

Every app's `wrangler.jsonc` sets `"preview_urls": false` at the top level, which each env block inherits. (Cloudflare
calls them Version URLs now, formerly Preview URLs; the Wrangler key kept the old name.) Left unset, they follow
`workers.dev`, which is on, and every uploaded version answers publicly at `<version>-<name>.<subdomain>.workers.dev`,
next to the custom domain and whatever guards it (Access, WAF rules, rate limits on the route). Cloudflare never makes
them for a Worker that implements a Durable Object (otta-web does), so the setting matters for the other apps; `false`
keeps every app the same. Nothing here needs them: PR previews are their own Workers on their own `workers.dev` URL. To
have them in one env, set `"preview_urls": true` in that env block. A test holds every app in this repository (and so
every template `otta new` copies) to `false`.

**Worker Previews, and why PR previews are separate Workers.** Cloudflare's newer Worker Previews (`wrangler preview`,
Wrangler 4.135+) run each branch as a preview inside the same Worker, with its own URL and its own Durable Object
namespaces. They are public by default, D1, KV and R2 are shared with production unless a `previews` block in the
Wrangler config binds other resources, queues are not consumed, and crons and routes stay production's. `otta deploy`
does not drive them: a PR preview is `otta deploy --preview`, a separate Worker on env.preview's resources (the preview
D1, KV and R2), which nothing in production can reach.

## GitHub Actions

### Secrets

Settings → Secrets and variables → Actions: `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile → API Tokens, with Workers
edit rights), `CLOUDFLARE_ACCOUNT_ID`, and the placeholder values of each app's `env.production` (and `env.preview` for
previews). Optional: `TURBO_API`, `TURBO_TOKEN`, `TURBO_REMOTE_CACHE_SIGNATURE_KEY` for the remote build cache
(`apps/otta-cache`).

### `deploy.yml`

1. **plan**: `otta deploy --all --plan` (or one app) prints `{"include":[{"app","reason","appType"}]}`; the reasons go
   to the job summary. On a push (when enabled) it diffs the push range (`--changed-since <before>`); a manual run
   deploys what it is asked to (`--force`, the default). Production comes from `main` only: a run on another branch
   fails and says so.
2. **build-packages**: every workspace package, Pro included, built once and cached.
3. **deploy**, one job per app, in parallel, one failure not stopping the others:
   `otta deploy <app> --ci --skip-packages --force` builds the app, checks `verifyPaths`, fills the config, deploys with
   the short commit as the version tag (the Worker reads it through `OBCF_VERSION`), checks health and writes the job
   summary. The Next.js build cache is restored for the apps the plan says are Next.js.

Run workflow → `app` (empty: every deployable app), `force`.

The deploy jobs run in the `production` GitHub Environment, whose link on the run is each app's URL. Under Settings →
Environments → production, limit it to the `main` branch and add required reviewers, and no production deploy starts
without an approval.

### `pr-preview.yml`

- **Opt-in**: `#deploy` or `#preview` in the PR title or description, or a manual run.
- **Deploy**: `otta deploy <app> --ci --preview <id>` deploys `env.preview` as its own Worker, `<name>-<id>` (`--name`,
  so wrangler adds no `-preview` suffix), for each app with `previewDeployable` true and an env.preview block. Previews
  share the preview D1/KV/R2; production data is never touched.
- **The id**: `pr-<N>` for a PR. A manual run takes `pr-<pr_number>` when given, else `br-<branch>-<hash>`: one preview
  per branch (each run replaces it), two branches never sharing one.
- **Cleanup**: `otta deploy --all --delete-preview <id>`, from every app whose manifest allows previews, deployable or
  not, when the PR closes (merged or not), when the branch is deleted, or by a manual run with `cleanup` ticked. One API
  call lists the account's Workers first: a PR or a branch that never had a preview costs no install.
- **Forks**: a PR from a fork gets no secrets, so it gets a notice instead of a preview (and no cleanup run). To preview
  it, push the branch to this repository.
- **Approval**: the deploy jobs run in the `preview` GitHub Environment, linked to the preview's URL. A PR's code runs
  with the repository's secrets, so add required reviewers to that environment (Settings → Environments → preview) and
  each preview waits for someone to approve it before its code sees a secret.

## Markers

| Marker        | Where                               | Effect                                                                                    |
| ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `#deploy`     | PR title or description             | Enables the PR preview                                                                    |
| `#preview`    | PR title or description             | Enables the PR preview                                                                    |
| `#skipdeploy` | The commit message (a merge commit) | `--ci` and `--plan` deploy nothing: Workers Builds and GitHub alike. `--force` overrides. |

## `otta deploy` flags for CI

| Flag                                              | Does                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--ci`                                            | Build and deploy only: no login, nothing created, no secret touched                                                                                                                                                            |
| `--all`                                           | Every deployable app; their packages built in one turbo run; one failure does not stop the others                                                                                                                              |
| `--plan`                                          | Print what the run would deploy and why, as JSON; deploy nothing                                                                                                                                                               |
| `--changed-since <ref>`                           | Deploy only apps a file changed for since the ref (the app, every workspace package it reaches, root build files; a file moved out of an app counts for it). If git cannot answer (a shallow clone, a first push), it deploys. |
| `--force`                                         | Ignore `#skipdeploy` and `--changed-since`                                                                                                                                                                                     |
| `--preview <id>`                                  | Deploy `env.preview` as the Worker `<name>-<id>`                                                                                                                                                                               |
| `--delete-preview <id>`                           | Delete that Worker                                                                                                                                                                                                             |
| `--watch-paths`                                   | Print the app's watch paths                                                                                                                                                                                                    |
| `--build-only`, `--skip-build`, `--skip-packages` | Split or reuse the build                                                                                                                                                                                                       |
| `--config-only`                                   | Write `wrangler.<env>.jsonc`, every value filled and checked, and stop: for a pipeline that builds and deploys its own way (a custom entry, a second Vite config), so it still uses this one engine                            |

## What a failure says

| Message                                                                  | Means                                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `apps/x/cloudflare-config.json is missing` / `unknown key` / `must be …` | The manifest; the message names the key and what it expects                                           |
| `"workerName" is no longer a setting (…): remove it`                     | A manifest from before this format; the message says what replaced the key                            |
| `The wrangler config does not parse: … at character N`                   | `wrangler.jsonc` itself is not valid JSONC                                                            |
| `No value for A, B (env.production of apps/x)`                           | Set those names in the CI's variables or secrets                                                      |
| `apps/x/package.json has no "build:worker" script`                       | The manifest names a script the app does not have                                                     |
| `The build left no .open-next in apps/x (…): an OpenNext app needs …`    | The build ran but did not produce `verifyPaths`; the hint is by `appType`, with what the folder holds |
| `health check: … answered HTTP 503 after 4 attempt(s)`                   | Deployed; the Worker did not answer well yet. Never fails the deploy; see `wrangler tail`             |
| `apps/x: not deployed (#skipdeploy in the commit message)`               | As asked; `--force` deploys anyway                                                                    |

## Files

```text
.github/workflows/deploy.yml          # production, manual (plan → build-packages → deploy per app)
.github/workflows/pr-preview.yml      # PR previews and their cleanup
.github/workflows/build-packages.yml  # the shared package build and cache
.github/workflows/ci.yml              # lint, type-check, test, build
schemas/cloudflare-config.schema.json # the manifest's schema
packages/cli/src/commands/deploy.ts       # otta deploy
packages/cli/src/commands/deploy-plan.ts  # the manifest reader and the plan
apps/<app>/cloudflare-config.json     # the app's deploy manifest
apps/<app>/wrangler.jsonc             # Cloudflare's config: name, bindings, placeholders
```
