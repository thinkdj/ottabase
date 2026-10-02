---
name: ottabase-cloudflare
description:
    The Ottabase way to work with Cloudflare Workers infrastructure — bindings, edge-runtime constraints, env access,
    binding parity, and multi-tenant cache keys. Use for "add a binding", "read an env var", "use KV/R2/queue", "cache
    this", "wrangler config", or any edge/Worker-runtime work. Encodes the rules that keep edge code correct and
    tenant-safe.
---

# Cloudflare / edge runtime the Ottabase way

This is a Workers project. Code runs at the edge — design for it.

## Edge-runtime rules

- **No Node-only APIs** (`fs`, `child_process`, …) in app/worker code.
- **Never read `process.env` in edge code** (lint-enforced). Read config via `getOttabaseConfig(env)`
  (`apps/*/ottabase/config.loader.ts`).
- Bindings use the `OBCF_*` convention (`OBCF_D1`, `OBCF_KV`, `OBCF_R2`, `OBCF_QUEUE`, `OBCF_ANALYTICS_*`, …).

## Binding parity

`wrangler.jsonc` is the source of truth; `cloudflare-env.d.ts` is **generated** from it. After adding/changing a binding
or var, run `pnpm --filter @ottabase/otta-web cf-typegen` and commit both files — never hand-edit the `.d.ts`. CI runs
`cf-typegen:check` and fails on drift.

## Use the wrappers, not raw bindings

`@ottabase/cf` wraps every binding type-safely: `createKVClient` / `createR2Client` / `createImagesClient` /
`createRateLimitingClient` (subpaths `@ottabase/cf/kv`, `/r2`, `/images`, `/rate-limiting`). **For the database, use
`@ottabase/db/drizzle-d1` + `@ottabase/ottaorm`, not the raw D1 client** — the raw client is only for non-OttaORM
access.

## Multi-tenant cache keys (never hand-format KV keys)

Use the key builders so tenants can't collide (`@ottabase/cf/cache-keys`): `globalKey` / `orgKey` / `userKey` / `appKey`
/ `orgAppKey` / `orgUserKey` / `appUserKey` / `orgAppUserKey` / `versionedOrgKey` (scope markers `org`/`app`/`usr`).
Read-through cache via `withCache` + `invalidateCache` / `invalidateCacheByPrefix` (`@ottabase/cf/kv-cache`).

- **Cache is an optimization only**: a miss, malformed value, or failed write must never change an authorization
  outcome. Fail closed, never open.

## Local dev & setup

`pnpm dev` runs Vite + Wrangler; `pnpm cf:setup` / `cf:validate` provision and verify resources (resource names come
from `wrangler.jsonc`, the single source of truth). Agents run per-package `--filter` builds/tests only; full app
builds/dev are the local user's (or a cloud agent's) job.

## Authoritative sources

`packages/cf/README.md`, `docs/cloudflare-features.md`, `docs/CLOUDFLARE_CONFIGURATION_GUIDE.md`, `docs/CACHE_KEYS.md`.
`AGENTS.MD` → "Edge Runtime", "Cloudflare binding parity", "Enforced by Lint". Full docs: `/llms-full.txt`.
