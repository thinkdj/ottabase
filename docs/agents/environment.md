# Environment & Bootstrap — Agent Runbook

> Dev-environment setup, dev servers, and first-run bootstrap — mainly for cloud/headless agents.
> Command quick reference lives in the root `AGENTS.md`.

## Environment

- **Node.js 24+** required (`.nvmrc` says `24`). Use `nvm install 24 && nvm use 24` if needed.
- **pnpm 10.27.0** is the package manager. Install via `corepack enable pnpm`.
- **No Docker** — all infrastructure is Cloudflare-native and emulated locally by Wrangler.
- Maintainer's local OS is Windows 11 (cmd, not PowerShell); CI/CD runs Linux/Ubuntu.

## Build/run policy for agents

Agents should only run build and test commands for a particular package using the `--filter` flag
(e.g., `pnpm build:pkg --filter=<package>` or `pnpm test --filter=<package>`). Do not run full app
builds (`pnpm build`, `pnpm dev`) unless you are a cloud agent; only cloud agents may execute full
builds or dev workflows. The local development user is responsible for running full app builds and
shares output with the agent as required.

## Starting the dev servers (cloud agents)

`pnpm dev` (or `node dev.js --noopen`) starts Vite (port 3003) and Wrangler (port 3004) in parallel.
Key caveats:

1. **Wrangler needs a `dist/` directory** in `apps/otta-web/`. If missing (first run, or after
   `pnpm clean`): `mkdir -p apps/otta-web/dist && echo '<html></html>' > apps/otta-web/dist/index.html`.
2. **Wrangler needs `CLOUDFLARE_API_TOKEN`** in non-interactive environments. Set a dummy value for
   local dev: `export CLOUDFLARE_API_TOKEN=dummy-local-dev`. Use `--local` flag if needed.
3. Start the servers separately for better control:
    - Backend: `cd apps/otta-web && CLOUDFLARE_API_TOKEN=dummy-local-dev npx wrangler dev --port 3004 --local`
    - Frontend: `cd apps/otta-web && npx vite --port 3003`
4. **Build scripts for native packages** (esbuild, workerd) may be ignored by pnpm. After
   `pnpm install`, run:
   `for dir in node_modules/.pnpm/esbuild@*/node_modules/esbuild; do (cd "$dir" && node install.js); done`
   and the same loop for `workerd@*/node_modules/workerd`.

## First-run bootstrap

After both servers are running, the platform requires bootstrap (creates DB tables + seeds roles +
creates owner account) via the `/__bootstrap__` API.

`POST /__bootstrap__/api/init` clears the entire **OBCF_KV** namespace first (platform state cache,
RBAC, queue, rate limits), then runs migrations — use this for a clean fresh install when KV may
contain stale keys.

```bash
BOOTSTRAP_SECRET=$(grep BOOTSTRAP_OWNER_SECRET apps/otta-web/.env.local | cut -d= -f2)
curl -s -X POST http://localhost:3004/__bootstrap__/api/init -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
curl -s -X POST http://localhost:3004/__bootstrap__/api/seed -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
curl -s -X POST http://localhost:3004/__bootstrap__/api/create-owner -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET" -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"<your-secure-password>","name":"Admin"}'
curl -s -X POST http://localhost:3004/__bootstrap__/api/finalize -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
```

## Known quirks

- `pnpm lint`: `@ottabase/ottalayout` has a pre-existing lint failure.
- Old template names `ottabase-template-app-tanstack` / `ottabase-template-app-nextjs-homepage` were
  renamed to `otta-web` / `otta-landing`; stale references can be updated or ignored.

## CI / PR checklist

- Run `pnpm build:pkg && pnpm test --filter=@ottabase/ottaorm` before opening a PR.
- Ensure `pnpm lint` and `pnpm type-check` pass locally or in CI.
- Formatting: `pnpm format` (prettier, whole repo); pre-commit via husky + lint-staged.
- PR description: short summary, affected packages, testing notes, migration steps.
