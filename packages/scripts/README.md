# @ottabase/scripts

CLI tools for Ottabase monorepo — Cloudflare resource setup, schema generation, migrations, and cache management.

## Overview

This package provides the `pnpm cf:*`, `pnpm db:*`, and `pnpm clean:*` scripts used across the monorepo.

## Cloudflare Setup CLI

### `pnpm cf:login`

Verifies Wrangler authentication and logs in if needed.

```bash
pnpm cf:login
```

### `pnpm cf:setup`

Interactive wizard that creates all required Cloudflare resources (D1, KV, R2, Queue) and prints the resource IDs for
use as GitHub Secrets. Does **not** modify `wrangler.jsonc`.

```bash
pnpm cf:setup          # Interactive: select resources to create
pnpm cf:setup --force  # Create all resources without prompts
```

**Output includes IDs for:**

- `D1_DATABASE_ID` — Production D1 database
- `D1_PREVIEW_DATABASE_ID` — Preview D1 database
- `KV_NAMESPACE_ID` — Production KV namespace
- `KV_PREVIEW_NAMESPACE_ID` — Preview KV namespace

### `pnpm cf:validate`

Validates that all resources in `wrangler.jsonc` exist in your Cloudflare account.

```bash
pnpm cf:validate
```

## DB Schema CLI

The db CLI tools use `db.config.ts` in your app directory to manage Prisma schema concatenation and D1 migrations.

### `pnpm db:generate`

Concatenates modular Prisma schemas into a single `schema.prisma` and runs `prisma generate`.

Create `db.config.ts` in your app:

```typescript
import { defineAppDbConfig } from '@ottabase/db';

export default defineAppDbConfig({
    appId: 'my-app',
    features: ['auth'], // adds auth tables to schema
});
```

Then run:

```bash
pnpm db:generate          # Concatenate schemas + prisma generate
pnpm db:generate --verbose  # Verbose output
pnpm db:generate --skip-generate  # Concatenate only, skip prisma generate
```

### `pnpm db:migrate`

Generates SQL migrations from Prisma schema for Cloudflare D1.

```bash
pnpm db:migrate --name=add_users_table  # Generate migration
pnpm db:migrate --name=add_column --apply  # Generate and apply to D1
```

### `pnpm db:migrate:apply`

Applies pending D1 migrations.

```bash
pnpm db:migrate:apply          # Apply to local D1
pnpm db:migrate:apply --remote  # Apply to remote/production D1
```

### `pnpm db:migrate:status`

Shows which migrations have been applied.

```bash
pnpm db:migrate:status
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
