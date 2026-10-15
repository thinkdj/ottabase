# @ottabase/vault

Backups, restore and per-tenant export for an Ottabase app. Every D1 table goes to R2 as NDJSON, comes back in one
transaction, and any one tenant's rows can be streamed out when a customer asks for their data.

D1 has point-in-time recovery; that is Cloudflare's safety net. This one is yours: a copy in a bucket you control,
readable by anything that reads JSON, restorable into a fresh database, portable off the platform.

Vault is a **Premium Package** (`@ottabase/premium`). The part that gets you out of trouble is free; what is sold is not
having to remember.

|                                                               | Free                      | Licensed                                 |
| ------------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| Manual backup, list, restore, delete                          | yes, up to 5 kept backups | yes, up to the license's `backups` limit |
| A user's own export (`GET /export/me`)                        | yes                       | yes                                      |
| Nightly schedule (`vault:backup`) with retention pruning      | no                        | yes                                      |
| Stale-backup health check in `/api/admin/health`              | no                        | yes                                      |
| Operator export of any tenant (`GET /export?organizationId=`) | no                        | yes                                      |

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
    // licensePublicKey: '…',  // your vendor key; defaults to the DEMO key published in this repo
});
```

List `vaultPackage` in `ottabase/packages.ts`; the premium registry (`worker/lib/premium.ts`) picks it up from the list
and mounts its routes behind the entitlement gate. The package has no tables of its own. It seeds a `vault:backup` task
at `23 2 * * *` and renders at **Admin → Infrastructure → Vault** (`VaultSettings` from `@ottabase/vault/react`; add
`'../../packages/vault/src/**/*.{js,ts,jsx,tsx}'` to the app's Tailwind `content`).

## Licensing

Paste a license at **Admin → Growth → Premium packages**, or set `PREMIUM_LICENSE_VAULT` (or a `PREMIUM_LICENSES` JSON
map). A license names features (`schedule`, `export`) and may raise the `backups` limit.
`packages/vault/src/demo-license.ts` holds the demo vendor's keypair and a perpetual pro license, so the whole flow can
be tried without buying anything; replace the public key for anything you sell (`generateLicenseKeypair` from
`@ottabase/premium/license-tools`).

A lapsed license closes the schedule and the operator export. Backups stay, restore stays, your data stays.

## Layout in the bucket

```
vault/<appId>/<backupId>/manifest.json      # tables, row counts, columns, CREATE statements
vault/<appId>/<backupId>/<table>.ndjson     # one JSON object per row; BLOBs as { "$blob": "<base64>" }
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

The core (`createVault`) is not gated: app code can call any of it. The gates live in the routes and the cron handler.
Restore intersects the backup's columns with the live table's, so a column dropped since the backup is skipped and
reported, and a table that no longer exists is left alone. With a driver that can `batch` (the `d1Driver` adapter does),
the whole restore is one transaction with `PRAGMA defer_foreign_keys`, so parents and children land together.

## Routes

| Route                                  | Who                | Gate             | Does                                                      |
| -------------------------------------- | ------------------ | ---------------- | --------------------------------------------------------- |
| `GET /backups`                         | platform admin     | free             | newest manifests (`?limit=`)                              |
| `POST /backups`                        | platform admin     | `backups` limit  | run a backup now (`{ tables?, label? }`); 402 at the cap  |
| `GET /backups/:id`                     | platform admin     | free             | one manifest                                              |
| `POST /backups/:id/restore`            | platform admin     | free             | `{ confirm: id, tables?, truncate? }`; replaces live rows |
| `DELETE /backups/:id`                  | platform admin     | free             | remove every object of the backup                         |
| `GET /export?organizationId=\|userId=` | platform admin     | `export` feature | NDJSON download of one tenant                             |
| `GET /export/me`                       | any signed-in user | free             | their organization (if they manage it) or their own rows  |

A closed gate answers `402 PREMIUM_REQUIRED` with `metadata.reason` (`LIMIT_REACHED`, `LICENSE_MISSING`, …) and the
purchase URL, which is what the admin page renders as the upsell.

## Design notes

- **The registry arrives at mount time.** A cron handler never sees the host, so `routes.build(host)` keeps the premium
  registry in a closure and the handler and the health probe ask it. Until the routes are mounted the schedule stays off
  and health reports why.
- **NDJSON, not SQLite files.** D1 does not hand out its database file; a row-per-line text format is what every tool
  can read, diff and import, and it slices per tenant.
- **Internal tables are skipped**: `_cf_KV`, `sqlite_sequence`, the migration ledgers. Pass `exclude` for your own.
- **Ceilings** (marked `ponytail:` in the code): a table's NDJSON is built in memory before the put, and a
  `WITHOUT ROWID` table is read in one query. Both hold comfortably for the databases D1 serves; the upgrade path is an
  R2 multipart upload per page.
