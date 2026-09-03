# @ottabase/otta-cache

Self-hosted [Turborepo remote cache](https://turborepo.dev/docs/core-concepts/remote-caching#self-hosting) on Cloudflare
Workers + R2. Implements the `v8` artifact API. One worker serves any number of projects: artifacts are namespaced
`{team}/{hash}` in a single R2 bucket, and each token is scoped to teams and to read or read-write.

It is deliberately outside the product runtime: no OttaORM, D1, KV, sessions or RBAC. Authorization is token-and-team.

## How it works

| Route                       | Behaviour                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /health`               | Unauthenticated `200` for the CI health check.                                                           |
| `GET /v8/artifacts/status`  | `{"status":"enabled"}`                                                                                   |
| `HEAD/GET /v8/artifacts/:h` | R2 lookup; returns `x-artifact-duration`, `x-artifact-tag`, `x-artifact-sha`, `x-artifact-dirty-hash`.   |
| `PUT /v8/artifacts/:h`      | Write-token only. Streams body to R2 with `If-None-Match: *` (create-only, atomic). Existing key: `200`. |
| `POST /v8/artifacts`        | Batch existence check, max 40 hashes.                                                                    |
| `POST /v8/artifacts/events` | `200`, body never read.                                                                                  |

All `/v8/*` routes need `Authorization: Bearer <token>` and `?slug=<team>` (or `teamId`). `401` no/unknown token, `403`
token not allowed for team or read-only on PUT, `400` bad team/hash/tag, `413` over `MAX_ARTIFACT_MB`.

Turbo signs artifacts client-side (`signature: true` in `turbo.json` + `TURBO_REMOTE_CACHE_SIGNATURE_KEY`). The worker
stores and returns the tag byte-for-byte and never verifies it; in production (`REQUIRE_SIGNED_UPLOADS=1`) it rejects
uploads without one. Objects expire via an R2 lifecycle rule, not code.

Files: `worker/auth.ts` (tokens), `worker/store.ts` (R2, no HTTP), `worker/turbo.ts` (protocol), `worker/index.ts`.

## Tokens

`TURBO_CACHE_TOKENS` is a worker secret: JSON keyed by token id, holding the **SHA-256 hex of the token**, never the
token itself.

```json
{
    "ci-rw": { "sha256": "<hex>", "teams": ["ottabase"], "write": true },
    "dev-ro": { "sha256": "<hex>", "teams": ["*"], "write": false }
}
```

Generate a token and its hash:

```bash
node -e "const c=require('crypto');const t=c.randomBytes(32).toString('base64url');console.log(t, c.createHash('sha256').update(t).digest('hex'))"
```

Policy: CI tokens are read-write. Developer tokens are read-only, so a Windows or dirty-tree build can never poison what
Linux CI restores. A second project gets its own team name and token entry; nothing else changes.

**Rotation:** add the new id to the JSON, `wrangler secret put TURBO_CACHE_TOKENS --env production`, switch the
consumer's `TURBO_TOKEN`, remove the old id, `secret put` again.

## One-time setup

```bash
cd apps/otta-cache
pnpm exec wrangler r2 bucket create ottabase-turbo-cache
pnpm exec wrangler r2 bucket create ottabase-turbo-cache-preview
pnpm exec wrangler r2 bucket lifecycle add ottabase-turbo-cache expire-30d --expire-days 30 -y
pnpm exec wrangler r2 bucket lifecycle add ottabase-turbo-cache-preview expire-30d --expire-days 30 -y
pnpm exec wrangler secret put TURBO_CACHE_TOKENS --env production   # paste the JSON above
```

Then in GitHub: add `otta-cache` to the `APPS_TO_DEPLOY` secret, and set `TURBO_API`
(`https://otta-cache-production.<CF_WORKER_SUBDOMAIN>.workers.dev`), `TURBO_TOKEN` (the rw token) and
`TURBO_REMOTE_CACHE_SIGNATURE_KEY` (any 32+ byte random string). `deploy.yml` deploys the worker like any other app; PR
previews skip it (`previewDeployable: false`).

Smoke test:

```bash
curl -sS -H "Authorization: Bearer $TURBO_TOKEN" "$TURBO_API/v8/artifacts/status?slug=ottabase"
# {"status":"enabled"}
```

## Using the cache locally

Nothing is committed; opt in with env vars. Devs get a read-only token.

```powershell
$env:TURBO_API = "https://otta-cache-production.<subdomain>.workers.dev"
$env:TURBO_TEAM = "ottabase"
$env:TURBO_TOKEN = "<read-only token>"
$env:TURBO_REMOTE_CACHE_SIGNATURE_KEY = "<same key as CI>"
pnpm build
```

```bash
TURBO_API=... TURBO_TEAM=ottabase TURBO_TOKEN=... TURBO_REMOTE_CACHE_SIGNATURE_KEY=... pnpm build
```

Unset `TURBO_TOKEN` and turbo is back to local-only. If the cache is unreachable, turbo warns and continues.

## Developing the worker

```bash
cp .dev.vars.example .dev.vars      # token "dev-token", read-write, all teams
pnpm dev                             # wrangler dev on :8787 with a local R2 simulator
```

Immutability check against the real R2 semantics (second PUT is a no-op, first body wins):

```bash
U="http://localhost:8787/v8/artifacts/deadbeefdeadbeef?slug=ottabase"; H="Authorization: Bearer dev-token"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H "$H" -H "x-artifact-tag: t" --data-binary first  "$U"   # 202
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H "$H" -H "x-artifact-tag: t" --data-binary second "$U"   # 200
curl -s -H "$H" "$U"                                                                                        # first
```

Point turbo at it with `TURBO_API=http://localhost:8787 TURBO_TOKEN=dev-token TURBO_TEAM=ottabase` (plus a signature
key). Gates: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` (`wrangler deploy --dry-run` → `dist/index.js`).

## Not built, on purpose

Usage stats, quotas, rate limiting, an admin UI, D1 token storage, event persistence. Accepted phase-one risk: a leaked
write token can upload unlimited unique hashes and raise R2 cost until rotated.
