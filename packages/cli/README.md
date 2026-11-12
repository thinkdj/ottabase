# @ottabase/cli

Ottabase monorepo CLI tool for scaffolding, developing, building, and testing apps.

## Installation

The CLI is available as part of the Ottabase monorepo. After installing dependencies:

```bash
pnpm install
```

The root workspace install builds the CLI automatically. In a workspace checkout, the executable also compares `src/`
with `dist/` and rebuilds only when sources are newer, so it cannot silently run stale compiled code. You can still
build it explicitly with:

```bash
pnpm --filter @ottabase/cli build
```

## Usage

### Scaffolding New Apps

```bash
# Create a new web app (Vite + TanStack Router + Cloudflare Workers), the whole template
pnpm otta new web my-app

# The same, stripped to what the product needs: a preset keeps part of the template
pnpm otta new web my-app --minimal         # auth, organizations, RBAC, the admin shell, Brand Engine
pnpm otta new web my-app --preset blog     # minimal plus the blog, comments and the legal pages
pnpm otta new web my-app --preset saas     # minimal plus alerts, API keys, flags, meter, postmaster, legal, referrals, vault, webhooks

# Create a landing page (Next.js + Cloudflare Workers), or a single Worker (API-first, no SPA)
pnpm otta new landing my-site               # reads the web app's content; --web <app> when there are several
pnpm otta new worker my-tool

# Show available templates and presets
pnpm otta templates
pnpm otta presets
```

The new app owns everything a second app in the account must not share: `ottabase-<app>-…` databases, buckets and
queues, `OTTABASE_<APP>_…` placeholders for CI's values, its own rate limiter ids and dev ports, and its `appId` (in
`ottabase.config.ts` and `.env.example`). `otta new` prints the ports, the CI value names and the next steps; the
walkthrough is [`docs/NEW_APP.md`](../../docs/NEW_APP.md).

A new app gets its own Cloudflare resource names (`ottabase-my-app-db`, `ottabase-my-app-bucket`,
`ottabase-my-app-queue`), its own Worker name, and the `.env.example` that `pnpm env:secrets --app=my-app` fills. With a
preset, the demo gallery and every package the preset does not keep are stripped (see below), and a short README
replaces otta-web's. Grow the app afterwards with `otta add`; ship it with `otta deploy`.

### Stripping the demo or a package

```bash
pnpm otta strip demo my-app              # the demo gallery, docs, marketing home, demo routes, seed content, Todo
pnpm otta strip ottablog my-app          # the blog: pages, routes, worker handlers, tables, the dependency
pnpm otta strip ottaai,shortlinks        # several, from the default app
pnpm otta strip demo my-app --dry-run    # the plan, nothing written
```

`otta strip` is the inverse of `otta add`. It removes what `add` wrote (the dependency, the composition, the entry in
`ottabase/packages.ts`, the client key, the table re-exports, the error reporter) and, beyond that, what the app itself
declares as the key's:

- **`ottabase/footprints.json`**: per key, the `paths` (files and folders) that exist only for it, the npm
  `dependencies` only it uses, and the keys it `needs` (a key that needs a stripped one is stripped along: `comments`
  needs `ottablog`, `ottaai` needs `meter`). A `description` says what the key is.
- **Markers** in the files the app keeps, on the lines a key owns there (a route, a nav entry, an import, a
  `packages.has()` branch):

    ```ts
    import { x } from './x'; // otta:only ottablog
    // otta:begin ottablog
    const blogRoute = publicRoute('/blog', …);
    // otta:end ottablog
    /* otta:unless demo
    export function HomePage() { … }      kept commented out until demo is stripped
    otta:end demo */
    ```

    `otta:only` takes one line, `otta:begin … otta:end` a block, `otta:unless … otta:end` a block that becomes live when
    the key goes (the starter home page in otta-web). A marker naming several keys (`otta:only ottablog   shortlinks`,
    on an import both use) goes when the last of them does. Markers of keys that stay are left in place. An unpaired
    marker stops the strip with its line number.

A package's pages copied from its `app/` folder are deleted only while they are still the shipped copy; an edited one is
left and named in the plan. `otta add <key> <app>` later copies the key's footprint paths back from `apps/otta-web`
(what is marked there is not copied: the plan says so).

`pnpm otta presets check [preset…]` scaffolds each preset into `apps/preset-check-<preset>`, borrows otta-web's
`node_modules`, and runs every tsconfig, the linter and the tests on the result, plus a check that no import of a
stripped package remains. CI runs it for `minimal`. Run it after changing the template, a footprint or a marker;
`--keep` leaves the app in place to look at.

### Adding a package to an app

```bash
otta add vault                      # @ottabase/vault into the default app
otta add @ottabase/postmaster my-app
otta add meter my-app --dry-run     # show the file changes, write nothing
otta add pro my-app                 # every package of a bundle (packages/pro/*), pages included
```

One command does every wiring step the package contract needs: the `workspace:*` dependency, a composition file under
`ottabase/packages/<key>.ts` (copied from `apps/otta-web` when it has one, otherwise a stub you fill in), the entry in
`ottabase/packages.ts`, the client key in `src/ottabase/config/packages.ts`, and the table re-exports in
`ottabase/db/schema.ts` for drizzle-kit. Every step is skipped when already done, so it is safe to re-run.

A package opts in with an `ottabase` field in its package.json:

```json
"ottabase": {
    "key": "postmaster",
    "factory": "createPostmasterPackage",
    "export": "postmasterPackage",
    "tables": { "import": "@ottabase/postmaster/schema", "names": ["emailSuppressionsTable"] }
}
```

`export` defaults to `<key>Package`, `manifestImport` to the package name (`@ottabase/ottaai` sets it to
`@ottabase/ottaai/manifest`), and `tables` is omitted when the package owns no Drizzle tables.

A package with a user interface can say more, and `otta add` writes that too:

- `adminPages`: entries for the client descriptor (path, title, icon, group, page module, export).
- An `app/` folder mirroring the app layout (`app/ottabase/packages/<key>.ts`, `app/src/pages/…`): copied in where the
  app has no such file yet. A shipped composition wins over the reference app's.
- `routes`: the package's other SPA pages, written into the client descriptor next to `adminPages`; the app router
  mounts them from there.
  `{ "path": "/status", "page": "status/StatusPage", "export": "StatusPage", "access": "public" }` (`access` defaults to
  `protected`, a signed-in page). Add `"menu": { "title": "Billing", "icon": "CreditCard" }` to link the page from the
  signed-in account menu.
- `errorReporter`: `{ "import": "./lib/blackbox", "export": "captureException" }` imports the function into
  `src/main.tsx` and passes it to the root `<ErrorBoundary onError>`.
- `notices`: `{ "checkout-complete": { "type": "success", "message": "You're in.", "inline": true } }` adds the URL
  notices the package redirects with to its client descriptor; the app registry names them `<key>.<code>`. Codes are
  kebab-case; `type` is success, info, warning or error.

A boundary that already has an `onError` is left alone and the plan says what to do by hand. Two packages routing one
path, or a package routing a path the app owns, stop the app at boot with both names. `page` is a module path under
`src/pages` (letters, digits, `_`, `-`, `/`), export names are identifiers that are not reserved words, and icons are
lucide-react export names.

### Deploying straight to Cloudflare

```bash
pnpm cf:login                                   # once: a browser login for wrangler
pnpm otta deploy my-app                         # env.production
pnpm otta deploy my-app --owner-email me@example.com --owner-password 'correct horse'   # and bootstrap
pnpm otta deploy my-app --env demo --set DEMO_URL=https://demo.example.com
pnpm otta deploy my-app --url https://my-app.example.com   # after a custom domain points at the Worker
pnpm otta deploy my-app --dry-run
```

The whole first deploy, from one terminal and without a GitHub repository:

1. **Resources.** `pnpm cf:setup --json --env <env>` creates the D1, KV, R2 and queue the env block of `wrangler.jsonc`
   names (named after the app by `otta new`), or finds them, and returns their ids.
2. **Config.** The placeholders of the env block (`D1_DATABASE_ID`, `KV_NAMESPACE_ID`, `CLOUDFLARE_ACCOUNT_ID`, …) are
   filled into `wrangler.<env>.jsonc`, gitignored. Ids come from step 1, the account id from `wrangler whoami`, anything
   else from `--set KEY=VALUE` or the environment; a placeholder with no value stops the deploy and names itself.
3. **Build and deploy.** The workspace packages the app depends on, and only those
   (`turbo run build --filter=<app>^...`; skip with `--skip-packages`), the app's build as its `cloudflare-config.json`
   says (`buildCommand`, then `workerBuildCommand` for an OpenNext app; `--skip-build` reuses the output and builds
   nothing), a check that the build left its `verifyPaths` (with a hint by `appType` when it did not), then
   `wrangler deploy --env <env>`, tagged with the short commit. The env defaults to the app's `wranglerEnv`.
4. **Secrets.** The generated secrets the app declares in `.env.example` (`AUTH_SECRET`, `MIGRATION_SECRET`,
   `BOOTSTRAP_OWNER_SECRET`, `CRON_SECRET`, …) and `AUTH_URL` are set where they are not set yet, and never changed
   afterwards. Your own secrets (OAuth clients, mail) stay `wrangler secret put`.
5. **Bootstrap.** With `--owner-email` and `--owner-password` (or `OTTA_OWNER_PASSWORD`), the fresh database gets its
   tables, roles and owner and is marked READY through `/__bootstrap__/api`. Without them the command prints the wizard
   URL with the bootstrap secret, once.
6. **Health.** `GET` the app's `healthCheckPath` (default `/api/health`), four tries over fifteen seconds while the
   deploy propagates, ten seconds each; any answer below 400 passes, a failure is reported and never fails the deploy.

Run it again after a change: it finds what exists and redeploys.

Every app Cloudflare deploys has a `cloudflare-config.json`, its deploy manifest: how it builds, what the build must
leave, its env, health path, previews, and whether CI deploys it (`deployable`). It is read strictly (an unknown key or
a wrong value stops the deploy and names itself); schema: `schemas/cloudflare-config.schema.json`.

### Deploying from CI (Cloudflare Workers Builds, GitHub Actions)

```bash
pnpm otta deploy my-app --ci                              # build and deploy, nothing else
pnpm otta deploy my-app --ci --build-only                 # Workers Builds' build command …
pnpm otta deploy my-app --ci --skip-build                 # … and its deploy command
pnpm otta deploy my-app --watch-paths                     # the include list for its build watch paths
pnpm otta deploy --all --ci --changed-since "$BEFORE_SHA" # every deployable app the push changed
pnpm otta deploy --all --plan --changed-since "$BEFORE_SHA"   # the same decision, as JSON (GitHub's matrix)
pnpm otta deploy my-app --ci --preview pr-12              # env.preview as the Worker <name>-pr-12
pnpm otta deploy --all --delete-preview pr-12             # and gone again
pnpm otta deploy my-app --ci --env demo --config-only     # only wrangler.demo.jsonc, for a pipeline of its own
```

`--ci` is the build and deploy of the steps above and nothing else: no login (wrangler authenticates with
`CLOUDFLARE_API_TOKEN`, which Workers Builds provides), no resource created, no secret generated or set, no bootstrap. A
value is looked up in `--set`, then `OTTA_DEPLOY_VALUES` (one JSON object, e.g. GitHub's `toJson(secrets)`; only the
names the env block uses are read, and the launcher removes it from the environment before anything loads, so no build
or dependency sees it), then the environment (Workers Builds' build variables). Every missing name, placeholders and the
manifest's `requiresSecrets` together, stops the run before anything builds. `requiresSecrets` are the build's own
values (blackbox's `BLACKBOX_UPLOAD_TOKEN` for its `postbuild` upload): they, and no other value, are handed to the
build scripts. Set the Worker's secrets once, with a first `otta deploy` from a terminal or `wrangler secret put`.

`#skipdeploy` in the commit message makes `--ci` and `--plan` deploy nothing; `--force` deploys anyway (and ignores
`--changed-since`). `--changed-since <ref>` deploys an app only when a file under its watch paths (the app, every
workspace package it reaches, the root build files; a file moved out of the app counts) changed since `<ref>`; when git
cannot answer (a shallow clone, the all-zero "before" of a first push), it deploys. Pass the commit before the push,
never `HEAD~1`, which sees only the last commit of a push. With `--all` every app whose manifest is `"deployable": true`
goes in turn, their packages built in one turbo run; the run reports each (and in GitHub, in the job summary) and fails
at the end when one failed. `--all --delete-preview <id>` cleans up every app whose manifest allows previews, deployable
or not.

In Workers Builds, one Worker per app: connect the repository, root directory `/`, deploy command
`pnpm otta deploy <app> --ci`, the env block's placeholders as build variables, and build watch paths from
`otta deploy <app> --watch-paths` (they live in the dashboard: re-paste them when the app gains a workspace dependency,
or use the broad `apps/<app>/*`, `packages/*`). The Worker name must match the env's (`<name>-<env>`,
`otta-web-production`). Use Workers Builds or GitHub's `deploy.yml` as the automatic deployer of a Worker, never both.
The full setup: `.github/DEPLOYMENT.md`.

### Updating Ottabase Pro

```bash
pnpm otta pro update                 # the newest release, into the default app
pnpm otta pro update my-app --tag v1.2.0
pnpm otta pro update --dry-run
```

Pro lives at `packages/pro` as a git subtree. The command runs `git subtree pull --squash` for the tag (the tree must be
clean), `otta add pro <app>` for anything the release adds (never overwriting what the app has), and prints the
release's `CHANGELOG.md` entry, with a warning when it names a newer public Ottabase than this repository may have. Then
`pnpm install && pnpm build:pkg`, the gates, the migrations in each environment, and a commit. In a repo that keeps
`.ottabase-upstream.json` (the `ottabase-update` skill's record) the command also sets `pro` there to the pulled tag.

### Starting apps and environments

```bash
# Default app from the root package.json
pnpm otta start

# Explicit app (directory or package name)
pnpm otta start otta-web
pnpm otta start @ottabase/otta-landing

# Named Wrangler environments run through local Wrangler (no deployment)
pnpm otta start otta-web --env preview
pnpm otta start otta-web --env staging
pnpm otta start otta-web --env production
pnpm otta start my-app --env staging # custom apps must define env.staging

# Common aliases
pnpm otta dev otta-web
pnpm otta preview otta-web

# Start one process from a multi-process development app
pnpm otta dev otta-web --process worker

# Override ports by primary or process name
pnpm otta start otta-web --port 3100
pnpm otta start otta-web --port-for worker=3101

# Reuse an existing build and inspect a plan without executing it
pnpm otta start otta-web --env preview --skip-build
pnpm otta start otta-web --env prod --dry-run
```

`dev`, `development`, and `local` select the hot-reload development topology. `prod` normalizes to `production`, `stage`
normalizes to `staging`, and every other valid name must exist under `env.<name>` in the selected `wrangler.jsonc`.
Missing environments fail before any build starts. Named environments build the app and Worker, then run
`wrangler dev --local --env <name>`; they never deploy. `--local` disables opt-in remote bindings, though platform-only
bindings can still use Cloudflare as documented by Wrangler.

The app selector is resolved in this order: positional app, `OTTABASE_APP`, root `ottabase.defaultApp`, then the only
app in the repo. `pnpm dev` is the short alias for `pnpm otta start`.

### App lifecycle contract

Framework details stay in each app package. `package.json#ottabase.start.development.processes` declares the scripts
that form one supervised development session. This block is also the only place dev ports live: `pnpm dev:kill`
(`--app=<name>` for one app) reads every `url`/`readyUrl` here to know what to free, so every app must declare it, even
a single-worker app like `otta-cache`.

```json
{
    "scripts": {
        "dev": "vite",
        "dev:worker": "wrangler dev --local"
    },
    "ottabase": {
        "start": {
            "development": {
                "processes": [
                    {
                        "name": "web",
                        "script": "dev",
                        "url": "http://127.0.0.1:3003",
                        "portEnv": "PORT_FE",
                        "primary": true
                    },
                    {
                        "name": "worker",
                        "script": "dev:worker",
                        "readyUrl": "http://127.0.0.1:3004/api/health",
                        "portEnv": "PORT_BE",
                        "portArg": "--port"
                    }
                ]
            },
            "worker": {
                "url": "http://127.0.0.1:3004",
                "readyUrl": "http://127.0.0.1:3004/api/health"
            }
        }
    }
}
```

A resolved port is exported to _every_ process in the session (siblings proxy to each other) and, when the process
declares `portArg`, also passed as a flag — Wrangler reads neither `portEnv` nor a shared environment. A port already
exported in the shell (`PORT_BE=3101 pnpm dev`) is picked up the same way, so readiness URLs always track the real
listeners.

The CLI starts all declared processes concurrently, prefixes each output line with its process name, waits for every
declared URL, and opens the primary URL once. When a process fails or the user presses Ctrl+C, it stops every process
tree. POSIX systems receive a graceful signal followed by a timed force-kill; Windows uses one forced tree termination
because a graceful signal cannot be forwarded reliably through the `cmd.exe`/pnpm shim without orphaning descendants.
Signals are supervised during named-environment builds as well as while servers run. Browser-launch failures are
warnings and do not take down an otherwise healthy app. An app with no lifecycle metadata falls back to its `dev`
script, so simple apps need no extra configuration.

Named environments use `cloudflare-config.json` as the build contract (`buildCommand`, `workerBuildCommand`, and
`wranglerConfig`). This is the same metadata consumed by CI, avoiding a second framework registry. App-specific
packaging limitations can be declared under `worker.unsupportedPlatforms`; execution then fails before a costly build,
while `--dry-run` still prints the complete cross-platform plan and limitation.

### Building

```bash
# Build an app for production
pnpm otta build my-app
```

### Testing

```bash
# Run tests
pnpm otta test my-app

# Run tests in watch mode
pnpm otta test my-app --watch

# Run tests with coverage
pnpm otta test my-app --coverage
```

### Linting

```bash
# Lint an app
pnpm otta lint my-app

# Lint and auto-fix
pnpm otta lint my-app --fix
```

### Type Checking

```bash
# Type check an app
pnpm otta type-check my-app
# or
pnpm otta types my-app
```

### Cleaning

```bash
# Clean build artifacts
pnpm otta clean my-app
```

### Listing Apps

```bash
# List all apps in the monorepo
pnpm otta list
# or
pnpm otta ls
```

### App Information

```bash
# Show detailed info about an app
pnpm otta info my-app
```

## Available Commands

`otta` is the command name the published binary installs. Inside this monorepo the root package does not link its own
bin, so invoke it through the workspace script: `pnpm otta <command>`.

| Command                      | Description                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `otta new <template> <name>` | Create a new app from a template (`--minimal`, `--preset <name>` for web; `--web <app>` for landing) |
| `otta add <package> [app]`   | Wire a workspace package, or every package of a bundle such as `pro`, into an app (`--dry-run`)      |
| `otta strip <keys> [app]`    | Take the demo, or a package, out of an app: the inverse of `otta add` (`--dry-run`)                  |
| `otta presets [check …]`     | Show the presets of `otta new web`; `check` scaffolds and gates them                                 |
| `otta deploy [app]`          | Deploy to Cloudflare: the whole first deploy, or build and deploy only from CI (`--ci`, `--all`)     |
| `otta pro update [app]`      | Pull a Pro release into `packages/pro`, wire what is new, show its release notes (`--tag`)           |
| `otta start [app]`           | Start development or a named local Wrangler environment                                              |
| `otta dev [app]`             | Start the hot-reload development topology                                                            |
| `otta preview [app]`         | Build and start the preview Wrangler environment locally                                             |
| `otta build [app]`           | Build an app for production (default: `ottabase.defaultApp`)                                         |
| `otta test [app]`            | Run tests for an app                                                                                 |
| `otta lint [app]`            | Lint an app                                                                                          |
| `otta type-check [app]`      | Type check an app                                                                                    |
| `otta clean [app]`           | Clean build artifacts                                                                                |
| `otta list`                  | List all apps in the monorepo                                                                        |
| `otta info <app>`            | Show detailed info about an app                                                                      |
| `otta templates`             | Show available templates                                                                             |

## Templates

### `web`

Full-featured Vite + TanStack Router + Cloudflare Workers app. Includes:

- Vite for fast development
- TanStack Router for routing
- Cloudflare Workers for backend
- OttaORM for database
- Authentication, RBAC, and more

Copied whole by default. With `--minimal` or `--preset <name>` the demo gallery and the packages the preset does not
keep are stripped; the core (auth, organizations and RBAC, the admin shell, Brand Engine, the app's own package) always
stays. An API-only app is the `worker` template, not a preset.

### `landing`

Next.js landing page with Cloudflare Workers deployment. Includes:

- Next.js for SSR/SSG
- OpenNext for Cloudflare deployment
- Tailwind CSS on the shared `@ottabase/ui-tailwind` preset
- The landing themes from `@ottabase/ottalanding`

### `worker`

Single Cloudflare Worker, server-rendered HTML and an API, no SPA and no asset build. Same `ottabase/packages.ts`
contract as `web`, an operator token instead of sessions, `/api/admin/init` to create tables, and the DB-driven
scheduler. Source: `apps/otta-worker`. For internal tools, webhook receivers, cron-driven jobs and first versions.

## Programmatic Usage

The CLI can also be used programmatically:

```typescript
import { listApps, getAppInfo, newApp, buildApp } from '@ottabase/cli';

// List all apps
const apps = listApps();
console.log(apps);

// Get info about a specific app
const app = getAppInfo('my-app');
console.log(app);

// Create a new app
await newApp('web', 'my-new-app');

// Build an app
await buildApp('my-app');
```

## CLI Development

```bash
# Build the CLI
pnpm --filter @ottabase/cli build

# Watch mode
pnpm --filter @ottabase/cli dev

# Run tests
pnpm --filter @ottabase/cli test

# Type check
pnpm --filter @ottabase/cli type-check
```

The workspace executable rebuilds stale or missing CLI output automatically. Published installations contain only the
already-built `dist/` output and do not perform workspace freshness checks.
