# @ottabase/scripts

CLI tools for Ottabase monorepo — Cloudflare resource setup and cache management.

## Overview

This package provides the `pnpm cf:*` and `pnpm clean:*` scripts used across the monorepo.

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
