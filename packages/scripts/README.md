# @ottabase/scripts

CLI tools for Ottabase monorepo — Cloudflare resource setup, schema generation, migrations, and cache management.

## Overview

This package provides the `pnpm cf:*` and `pnpm clean:*` scripts used across the monorepo. It also ships a
Prisma-based DB Schema CLI (`db-generate`, `db-migrate`, `db-migrate-apply`, `db-migrate-status`) for apps that use
Prisma with Cloudflare D1 — see [DB Schema CLI](#db-schema-cli) below for its current status in this repo.

## Cloudflare Setup CLI

Resource names (D1, KV, R2, Queue) are read from the target app's `wrangler.jsonc` (the single source of truth), so
nothing is hardcoded. The KV namespace **title** is derived from the worker `name` (e.g. `otta-web-kv`) and kept
distinct from the wrangler **binding** (`OBCF_KV`) so multiple apps in one Cloudflare account never collide. See
[Targeting an app](#targeting-an-app) for how the app is selected.

### `pnpm cf:login`

Verifies Wrangler authentication and logs in if needed.

```bash
pnpm cf:login
```

### `pnpm cf:setup`

Interactive wizard that creates all required Cloudflare resources (D1, KV, R2, Queue) and prints the resource IDs for
use as GitHub Secrets. Does **not** modify `wrangler.jsonc`.

Pass script flags after `--` so pnpm forwards them to the script:

```bash
pnpm cf:setup                     # Interactive: select resources to create (default app)
pnpm cf:setup -- --force          # Create all resources without prompts
pnpm cf:setup -- --app=<name>     # Target a specific app (see "Targeting an app")
```

**Output includes IDs for** (the GitHub Secret names are read from `wrangler.jsonc` `env.production` / `env.preview`):

- `D1_DATABASE_ID` — Production D1 database
- `D1_PREVIEW_DATABASE_ID` — Preview D1 database
- `KV_NAMESPACE_ID` — Production KV namespace
- `KV_PREVIEW_NAMESPACE_ID` — Preview KV namespace

### `pnpm cf:validate`

Validates that all resources in `wrangler.jsonc` exist in your Cloudflare account.

```bash
pnpm cf:validate
```

### Targeting an app

All three `cf:*` commands operate on one app's `wrangler.jsonc`. The app is selected in this order (first match wins):

1. `--app=<name>` flag: `pnpm cf:setup -- --app=otta-landing`
2. `OTTABASE_CF_APP` (or `CF_APP`) env var:
    - bash: `OTTABASE_CF_APP=otta-landing pnpm cf:setup`
    - PowerShell: `$env:OTTABASE_CF_APP="otta-landing"; pnpm cf:setup`
3. Root `package.json` → `ottabase.cfApp` (the repo's declared default):
    ```json
    { "ottabase": { "cfApp": "otta-web" } }
    ```
4. The only app under `apps/*` that has a `wrangler.jsonc`.

If a repo has multiple apps and none of the above is set, the command stops and lists the available apps so you can pass
`--app`. The app's `pnpm --filter` target is read from its `package.json` `name`, so the directory name and package name
can differ.

## DB Schema CLI

The db CLI tools use `db.config.ts` in your app directory to manage Prisma schema concatenation and D1 migrations.

> **Status:** these tools are not currently wired up for use in this repo. Their executables
> (`bin/db-generate.cjs`, `bin/db-migrate.cjs`, `bin/db-migrate-apply.cjs`, `bin/db-migrate-status.cjs`) exist on
> disk but are not declared in this package's `bin` field, and no `pnpm db:*` scripts are defined anywhere in the
> monorepo (the root `package.json` has no `db:*` entries, and the repo's app, otta-web, manages its schema with
> Drizzle directly via its own `db:push`/`db:studio` scripts instead). To actually use this CLI in an app you'd
> first need to add the `db-generate`/`db-migrate`/`db-migrate-apply`/`db-migrate-status` entries to this package's
> `bin` field and wire up corresponding `db:*` scripts. The commands below describe the intended usage once that
> wiring exists.

### `db-generate`

Concatenates modular Prisma schemas into a single `schema.prisma` and runs `prisma generate`.

Create `db.config.ts` in your app:

```typescript
import { defineAppDbConfig } from '@ottabase/db/config';

export default defineAppDbConfig({
    appId: 'my-app',
    features: ['auth'], // adds auth tables to schema
});
```

Then run:

```bash
db-generate          # Concatenate schemas + prisma generate
db-generate --verbose  # Verbose output
db-generate --skip-generate  # Concatenate only, skip prisma generate
```

### `db-migrate`

Generates SQL migrations from Prisma schema for Cloudflare D1.

```bash
db-migrate --name=add_users_table  # Generate migration
db-migrate --name=add_column --apply  # Generate and apply to D1
```

### `db-migrate-apply`

Applies pending D1 migrations.

```bash
db-migrate-apply          # Apply to local D1
db-migrate-apply --remote  # Apply to remote/production D1
```

### `db-migrate-status`

Shows which migrations have been applied.

```bash
db-migrate-status
```

## Cache/Reset CLI

### `pnpm clean:cache`

Clears Turborepo cache (`.turbo` directories and `node_modules/.cache/turbo`).

```bash
pnpm clean:cache
```

### `pnpm clean:reset`

Full monorepo reset — removes `node_modules`, `dist`, and cache directories.

```bash
pnpm clean:reset
```

### `pnpm clean:db`

Clears local Wrangler D1 state (`.wrangler/state/v3/d1/`).

```bash
pnpm clean:db
```

### `pnpm clean:kv`

Clears local Wrangler KV state (`.wrangler/state/v3/kv/`).

```bash
pnpm clean:kv
```

## Installation

This package is pre-installed in the monorepo. For apps within the monorepo:

```json
{
    "devDependencies": {
        "@ottabase/scripts": "workspace:*"
    }
}
```

## License

MIT
