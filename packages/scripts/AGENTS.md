# @ottabase/scripts — agent notes

Dev CLI tooling for Cloudflare setup/validation and monorepo cache cleanup. Full docs: ./README.md

## Use when

- Running root scripts: `pnpm cf:login` / `cf:setup` / `cf:validate`, `pnpm clean:cache` / `clean:reset` / `clean:db` / `clean:kv` / `clean:cf`, `pnpm dev:kill:ports`.
- NOT for importing from application code: the root export (`src/index.ts`) has no runtime symbols, and the `./schema` and `./migrations` subpath exports are explicitly `null` in package.json.

## Canonical usage

```bash
pnpm cf:setup                  # interactive: pick D1/KV/R2/Queue resources to create
pnpm cf:setup -- --force       # create everything without prompts
pnpm cf:setup -- --app=otta-landing
pnpm cf:validate               # check wrangler.jsonc resources exist in the CF account
```

```bash
pnpm clean:cache               # clear turbo/node caches
pnpm clean:cf                  # clean:db + clean:kv (local wrangler state)
pnpm dev:kill:ports            # frees dev ports 3003 and 3004
```

## Gotchas

- Pass flags after `--` so pnpm forwards them (e.g. `pnpm cf:setup -- --force`).
- App selection order for `cf:*`: `--app=<name>` flag > `OTTABASE_CF_APP` / `CF_APP` env > `ottabase.cfApp` in root package.json > the only app under `apps/*` with a `wrangler.jsonc`. Multiple apps with none of these set is an error.
- Resource names are read from the target app's `wrangler.jsonc` (single source of truth); `cf:setup` creates resources and prints IDs for GitHub Secrets but never modifies `wrangler.jsonc`.
- `bin/` also ships `db-generate.cjs` / `db-migrate*.cjs` wrappers, but no root `db:*` scripts are wired to them — apps use `drizzle-kit` (`db:push`, `db:studio`) directly.
- Depends on `@ottabase/db` (workspace:*); Node-only CLIs, exempt from the repo's edge-runtime rule.
