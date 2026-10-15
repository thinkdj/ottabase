# @ottabase/vault

Backups, restore and per-tenant export for an Ottabase app. Every D1 table goes to R2 as NDJSON on a schedule, comes
back in one transaction, and any one tenant's rows can be streamed out when a customer asks for their data.

D1 has point-in-time recovery; that is Cloudflare's safety net. This one is yours: a copy in a bucket you control,
readable by anything that reads JSON, restorable into a fresh database, portable off the platform.

## Install

```bash
pnpm add @ottabase/vault
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

List `vaultPackage` in `ottabase/packages.ts`. The package has no tables of its own. It installs the admin routes under
`/api/vault`, seeds a `vault:backup` task at `23 2 * * *` (back up, then prune backups older than 30 days, never the
newest), and reports in `/api/admin/health` when the newest backup is more than 48 hours old.

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

Restore intersects the backup's columns with the live table's, so a column dropped since the backup is skipped and
reported, and a table that no longer exists is left alone. With a driver that can `batch` (the `d1Driver` adapter does),
the whole restore is one transaction with `PRAGMA defer_foreign_keys`, so parents and children land together.

## Routes

| Route                                  | Who                | Does                                                      |
| -------------------------------------- | ------------------ | --------------------------------------------------------- |
| `GET /backups`                         | platform admin     | newest manifests (`?limit=`)                              |
| `POST /backups`                        | platform admin     | run a backup now (`{ tables?, label? }`)                  |
| `GET /backups/:id`                     | platform admin     | one manifest                                              |
| `POST /backups/:id/restore`            | platform admin     | `{ confirm: id, tables?, truncate? }`; replaces live rows |
| `DELETE /backups/:id`                  | platform admin     | remove every object of the backup                         |
| `GET /export?organizationId=\|userId=` | platform admin     | NDJSON download of one tenant                             |
| `GET /export/me`                       | any signed-in user | their organization (if they manage it) or their own rows  |

## Design notes

- **NDJSON, not SQLite files.** D1 does not hand out its database file; a row-per-line text format is what every tool
  can read, diff and import, and it slices per tenant.
- **Internal tables are skipped**: `_cf_KV`, `sqlite_sequence`, the migration ledgers. Pass `exclude` for your own.
- **Ceilings** (marked `ponytail:` in the code): a table's NDJSON is built in memory before the put, and a
  `WITHOUT ROWID` table is read in one query. Both hold comfortably for the databases D1 serves; the upgrade path is an
  R2 multipart upload per page.
