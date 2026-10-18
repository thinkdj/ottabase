# otta-worker

The second app shape: one Cloudflare Worker, server-rendered HTML, an API, and the same package contract as `otta-web`.
No SPA, no React, no asset build. For an internal tool, a webhook receiver, a cron-driven job, a single-purpose API, or
the first version of anything.

```bash
otta new worker my-tool      # scaffold
otta dev my-tool             # wrangler dev on :3005
otta add postmaster my-tool  # install a package
```

## What is in the box

| Path                          | Role                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `worker/index.ts`             | `fetch`, `scheduled`, `queue`                                                        |
| `worker/routes.ts`            | `/` (rendered package overview), `/api/health`, `/api/admin/*`, then `mountPackages` |
| `worker/cron.ts`              | the DB-driven scheduler over every manifest's `cron` handlers                        |
| `worker/queue.ts`             | one handler per queue job type the manifests declare                                 |
| `worker/lib/db-utils.ts`      | connect the ORM, register package models and policies, `initDatabase()`              |
| `ottabase/packages.ts`        | **the one list** of installed packages                                               |
| `ottabase/packages/*.ts`      | one composition per package (`core`, `vault`, `fleet` to start)                      |
| `ottabase/packages/caller.ts` | the operator token as a package caller                                               |
| `ottabase/config.loader.ts`   | `appId`, `environment`, from env                                                     |
| `ottabase/db/schema.ts`       | the tables, as static exports (scheduler + package tables)                           |

## Auth: one operator, one token

This shape has no users. `ADMIN_TOKEN` (a Wrangler secret) is the platform admin: it opens `/api/admin/*` and every
package route that asks for a caller (`/api/vault/*`, a future `/api/flags/overrides`). Local development
(`ENVIRONMENT=development`) is open. When the app grows users, add `@ottabase/auth` and swap `caller.ts` for a session
lookup; nothing else changes.

```bash
wrangler secret put ADMIN_TOKEN
curl -H "Authorization: Bearer $TOKEN" https://my-tool.example.workers.dev/api/admin/health
```

## Premium packages

Premium packages in the list (Vault ships in it) are mounted behind their license gate, and `/api/premium` is the
control plane, behind the operator token. A license comes from env (`PREMIUM_LICENSE_VAULT`, or a `PREMIUM_LICENSES`
JSON map) or is pasted once:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
     -d '{"license":"otta_premium_v1.…"}' http://127.0.0.1:3005/api/premium/packages/vault/license
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3005/api/premium/packages   # state, plan, features
```

Unlicensed, Vault still backs up and restores by hand (five kept backups); the nightly schedule waits for a key. The
home page shows each premium package's state next to its key.

`@ottabase/fleet` makes this Worker a beacon: with `wrangler secret put FLEET_TOKEN`, a cockpit reads
`GET /api/fleet/report` (packages, health, tasks, newest backup, license states) and can run `POST /api/fleet/init`,
which does what `/api/admin/init` does. The cockpit that watches a fleet of these is a paid add-on outside this repo.

## First run

```bash
otta dev my-tool
curl -X POST http://127.0.0.1:3005/api/admin/init    # creates every table, seeds package cron schedules
open http://127.0.0.1:3005/                           # what is installed, where it listens
```

`POST /api/admin/init` is idempotent: run it after every deploy that added a package. The scheduler also seeds missing
schedules on its first tick, so a deploy with the cron trigger needs no click for housekeeping to start.

## Adding a package

```bash
otta add meter my-tool
```

writes the dependency, copies otta-web's composition for the package into `ottabase/packages/meter.ts` (or a stub when
there is none), lists it, and re-exports its tables. Compositions copied from otta-web import `../config.loader` and
`./caller`, both of which exist here with the same names, so they work unchanged. Review the composition, then
`otta type-check my-tool && otta test my-tool`.

## Deploying

```bash
otta build my-tool     # wrangler deploy --dry-run: bundles and reports size
pnpm --filter @ottabase/my-tool deploy
```

Bindings and placeholders in `wrangler.jsonc` follow the two-tier scheme documented in `apps/otta-web/wrangler.jsonc`
and `CLOUDFLARE_DEPLOY.md`.

## When to graduate

Move to `otta new web` when you need signed-in users, an admin UI, or a client app. Until then, this shape deploys in
seconds and has nothing to keep up to date but the packages you chose.
