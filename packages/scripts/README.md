# @ottabase/scripts

CLI tools for Ottabase monorepo — Cloudflare resource setup, local env secrets, and cleanup.

## Overview

This package provides the `pnpm cf:*`, `pnpm env:*` and `pnpm clean:*` scripts used across the monorepo. The prefix
tells you what a command touches:

| Prefix   | Touches                                                                     |
| -------- | --------------------------------------------------------------------------- |
| `cf:`    | Your **remote** Cloudflare account — creates or verifies real resources     |
| `env:`   | The target app's local `.env.local`                                         |
| `clean:` | **Local only** — Wrangler state on disk and build caches, never the account |

## Help CLI

### `pnpm commands`

Prints every root `package.json` script as a grouped, annotated table — the fastest way back into the repo after a
break, and the first thing to show a new contributor.

```bash
pnpm commands              # Everything, grouped
pnpm commands clean        # Filter by name, description or group
pnpm commands --all        # Include internal lifecycle scripts (prepare, postinstall, ...)
pnpm run help              # Same table; `pnpm help` alone hits pnpm's own builtin
```

The list is read from `package.json` at runtime and joined with the descriptions in `src/cli/help.ts`, so it can never
advertise a script that does not exist. Drift is visible in both directions:

- a script with no description appears under **Other** as `(undocumented)`
- a description whose script has been deleted is reported as **Stale docs**

A test asserts both lists are empty, so adding a root script without documenting it fails the suite. If `package.json`
itself can't be found or fails to parse, the command reports that error directly instead of rendering an empty table.

Commands carry one of three risk markers rather than a single generic "destructive" flag, since a cache clear, a
database wipe, and a billable Cloudflare API call are not the same kind of risk:

| Marker | Meaning                                                               |
| ------ | --------------------------------------------------------------------- |
| `!`    | Deletes real local data (D1/KV/R2) — prompts for a typed YES          |
| `$`    | Creates billable resources in your Cloudflare account                 |
| `~`    | Prompts for a typed YES but only clears a trivially-rebuildable cache |

The `cf:` / `clean:` groups also carry a note saying which one touches your real Cloudflare account.

**When you add a root script**, add a matching entry to `COMMAND_REGISTRY` in `src/cli/help.ts`.

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

## Environment CLI

### `pnpm env:secrets`

Generates development-safe values for fillable keys in the target app's `.env.local` using the local `.env.example` as
the source of truth for which keys are available. Creates `.env.local` from the template if it does not exist yet.

- Keeps existing non-empty keys intact (idempotent/rerun-safe).
- Generates only allowlisted Ottabase local secrets, such as `AUTH_SECRET`, `MIGRATION_SECRET`,
  `BOOTSTRAP_OWNER_SECRET`, and `CRON_SECRET`.
- Leaves third-party provider credentials empty, such as OAuth client secrets and API keys.
- Skips keys that already have a non-empty value.
- Uses readable prefixes for generated values (for example, `BOOTSTRAP_OWNER_SECRET` uses `BOS`).

```bash
pnpm env:secrets                    # Uses the default app (or app selected by env/flags below)
pnpm env:secrets -- --app=otta-web  # Target specific app
```

### Targeting an app

All app-scoped commands (`cf:*`, `env:secrets`) resolve the target app in this order (first match wins):

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

## Cleanup CLI

Every `clean:*` command is **local only** — it deletes files under your working copy and never touches your Cloudflare
account. Use `cf:*` for anything remote.

They all sweep the repo root plus every `apps/*` and `packages/*` workspace, so they are not app-scoped the way `cf:*`
is.

| Command       | Deletes                                                              |
| ------------- | -------------------------------------------------------------------- |
| `clean:cache` | Turborepo caches (`.turbo`, `node_modules/.cache/turbo`)             |
| `clean:d1`    | Local D1 state (`.wrangler/state/*/d1`)                              |
| `clean:kv`    | Local KV state (`.wrangler/state/*/kv`)                              |
| `clean:state` | All local Wrangler state — D1 + KV + R2 (`.wrangler/state/*`)        |
| `clean:all`   | `.wrangler/`, build caches, and `packages/*/dist` — everything above |

### Confirmation

All five prompt for a typed `YES` before deleting. Pass `--yes` (or `-y`) after `--` to skip the prompt in CI or
scripts:

```bash
pnpm clean:cache            # Prompts for YES
pnpm clean:d1 -- --yes      # Non-interactive
pnpm clean:state -- -y      # Non-interactive
```

### `pnpm clean:state` vs `pnpm clean:all`

`clean:state` wipes the data your app persists locally (D1, KV, R2) and leaves your build output alone — use it when you
want to re-run bootstrap against an empty database. `clean:all` additionally removes build caches and `packages/*/dist`,
so it needs a `pnpm build:pkg` afterwards.

Neither one deletes `node_modules` — run `pnpm install` separately if you need that.

After `clean:d1`, `clean:state`, or `clean:all`, re-initialize the platform via `/__bootstrap__` (see the root
`QUICKSTART.md`).

### If a path can't be removed

A directory still open elsewhere — a running `pnpm dev` / `wrangler dev`, an editor, or antivirus scanning it — doesn't
abort the run. Everything else still gets deleted; the locked path is listed by name at the end with the reason (e.g.
`EBUSY`), and the command exits non-zero so a script chaining on it can tell a partial clean from a complete one. Stop
whatever has the path open and re-run the command.

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
