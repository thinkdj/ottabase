# @ottabase/vault

Backups, restore and per-tenant export for an Ottabase app. Every D1 table goes to R2 as NDJSON, comes back in one
transaction, and any one tenant's rows can be streamed out when a customer asks for their data.

D1 has point-in-time recovery; that is Cloudflare's safety net. This one is yours: a copy in a bucket you control,
readable by anything that reads JSON, restorable into a fresh database, portable off the platform.

Everything is free: manual backup, list, restore and delete, a nightly schedule (`vault:backup`) with retention pruning,
a stale-backup health check in `/api/admin/health`, operator export of any tenant, and every user's own export.

## Install

```bash
otta add vault my-app        # or by hand:
```

```typescript
// apps/otta-web/ottabase/packages/vault.ts
import { createVault, createVaultPackage, d1Driver } from '@ottabase/vault';

export const vault = createVault<CloudflareEnv>({
    driver: (env) => d1Driver(env.OBCF_D1),
    bucket: (env) => env.OBCF_R2 ?? null,
    appId: (env) => getOttabaseConfig(env).appId,
});

export const vaultPackage = createVaultPackage<CloudflareEnv>({
    vault,
    resolveCaller: resolvePackageCaller,
    env: { required: ['OBCF_D1', 'OBCF_R2'] },
});
```

List `vaultPackage` in `ottabase/packages.ts`; the kernel mounts its routes like any other package's. The package has no
tables of its own. It seeds a `vault:backup` task at `23 2 * * *` and renders at **Admin → Infrastructure → Vault**
(`VaultSettings` from `@ottabase/vault/react`; add `'../../packages/vault/src/**/*.{js,ts,jsx,tsx}'` to the app's
Tailwind `content`).

## Layout in the bucket

```
vault/<appId>/<backupId>/manifest.json      # tables, row counts, columns, CREATE statements
vault/<appId>/<backupId>/<table>.ndjson     # one JSON object per row; BLOBs as { "$blob": "<base64>" }
vault/<appId>/<backupId>/objects.ndjson     # with `objects`: one line per bucket object (key, etag, size, uploaded, type)
vault/<appId>/_objects/<etag>               # the bytes of every snapshotted object, once per etag, shared by every backup
```

Backup ids are timestamps (`20261016T022300Z-3f9a`), so a listing sorts chronologically. The manifest is written last: a
backup that died halfway is never listed and never restored.

## API

```typescript
await vault.backup(env, { label: 'before migration' }); // every user table; or { tables: ['posts'] }
await vault.list(env); // manifests, newest first
await vault.restore(env, id); // empty each table, put the rows back, one transaction
await vault.restore(env, id, { tables: ['posts'], truncate: false }); // upsert into the live table
await vault.prune(env, 30); // ids removed
vault.export(env, { column: 'organization_id', value: orgId }); // ReadableStream of {table,row} NDJSON lines
```

App code can call any of the core (`createVault`) directly; the routes add the caller checks. Restore intersects the
backup's columns with the live table's, so a column dropped since the backup is skipped and reported, and a table that
no longer exists is left alone. With a driver that can `batch` (the `d1Driver` adapter does), the whole restore is one
transaction with `PRAGMA defer_foreign_keys`, so parents and children land together.

### The bucket's own objects

Uploads, media and files live in R2 beside the database, and they are state too. With `objects` in `createVault`
(otta-web passes `{ exclude: ['og/'] }`), every backup also snapshots the bucket: `objects.ndjson` lists each object
under the chosen `prefixes` (default: everything but the vault's own prefix and `exclude`), and each object's bytes are
copied into the content store `_objects/<etag>` once. A second snapshot of an unchanged bucket copies nothing; only
changed or new objects cost a copy. Restore puts every listed object back under its key with its metadata, skipping the
ones whose live etag already matches, and reports keys whose bytes are gone (`objects.missing`). Pruning deletes the
bytes no remaining backup names. `backup(env, { objects: false })` and `restore(env, id, { objects: false })` leave the
bucket out of one run. The source can be another bucket (`objects.bucket`).

Copies are a `get` streamed into a `put`, as R2 copies. A bucket whose first snapshot outgrows one cron tick is the
ceiling here (marked `ponytail:`); steady state copies only what changed.

## Routes

| Route                                  | Who                | Does                                                                            |
| -------------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `GET /backups`                         | platform admin     | newest manifests (`?limit=`)                                                    |
| `POST /backups`                        | platform admin     | run a backup now (`{ tables?, label?, objects? }`)                              |
| `GET /backups/:id`                     | platform admin     | one manifest                                                                    |
| `POST /backups/:id/restore`            | platform admin     | `{ confirm: id, tables?, truncate?, objects? }`; replaces live rows and objects |
| `DELETE /backups/:id`                  | platform admin     | remove every object of the backup                                               |
| `GET /export?organizationId=\|userId=` | platform admin     | NDJSON download of one tenant                                                   |
| `GET /export/me`                       | any signed-in user | their organization (if they manage it) or their own rows                        |

## Design notes

- **NDJSON, not SQLite files.** D1 does not hand out its database file; a row-per-line text format is what every tool
  can read, diff and import, and it slices per tenant.
- **Internal tables are skipped**: `_cf_KV`, `sqlite_sequence`, the migration ledgers. Pass `exclude` for your own.
- **Ceilings** (marked `ponytail:` in the code): a table's NDJSON is built in memory before the put, and a
  `WITHOUT ROWID` table is read in one query. Both hold comfortably for the databases D1 serves; the upgrade path is an
  R2 multipart upload per page.
