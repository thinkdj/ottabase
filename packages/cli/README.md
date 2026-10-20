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
# Create a new web app (Vite + TanStack Router + Cloudflare Workers)
pnpm otta new web my-app

# Create a new landing page (Next.js + Cloudflare Workers)
pnpm otta new landing my-site

# Show available templates
pnpm otta templates
```

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
- `routes`: SPA pages registered in `src/router.tsx` as `<key><Path>Route` constants listed in `coreRoutes`, e.g.
  `{ "path": "/status", "page": "status/StatusPage", "export": "StatusPage", "access": "public" }` (`access` defaults to
  `protected`, a signed-in page).
- `errorReporter`: `{ "import": "./lib/blackbox", "export": "captureException" }` imports the function into
  `src/main.tsx` and passes it to the root `<ErrorBoundary onError>`.

A router without `coreRoutes`, or a boundary that already has an `onError`, is left alone and the plan says what to do
by hand. So is a path another page already routes; a generated name the app already uses gets a numeric suffix. `page`
is a module path under `src/pages` (letters, digits, `_`, `-`, `/`), and export names are identifiers that are not
reserved words.

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

| Command                      | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `otta new <template> <name>` | Create a new app from a template                                                                |
| `otta add <package> [app]`   | Wire a workspace package, or every package of a bundle such as `pro`, into an app (`--dry-run`) |
| `otta start [app]`           | Start development or a named local Wrangler environment                                         |
| `otta dev [app]`             | Start the hot-reload development topology                                                       |
| `otta preview [app]`         | Build and start the preview Wrangler environment locally                                        |
| `otta build <app>`           | Build an app for production                                                                     |
| `otta test <app>`            | Run tests for an app                                                                            |
| `otta lint <app>`            | Lint an app                                                                                     |
| `otta type-check <app>`      | Type check an app                                                                               |
| `otta clean <app>`           | Clean build artifacts                                                                           |
| `otta list`                  | List all apps in the monorepo                                                                   |
| `otta info <app>`            | Show detailed info about an app                                                                 |
| `otta templates`             | Show available templates                                                                        |

## Templates

### `web`

Full-featured Vite + TanStack Router + Cloudflare Workers app. Includes:

- Vite for fast development
- TanStack Router for routing
- Cloudflare Workers for backend
- OttaORM for database
- Authentication, RBAC, and more

### `landing`

Next.js landing page with Cloudflare Workers deployment. Includes:

- Next.js for SSR/SSG
- OpenNext for Cloudflare deployment
- Tailwind CSS
- shadcn/ui components

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
