// ============================================================
// Vault (@ottabase/vault): backups to R2, restore, per-tenant export
// ============================================================
// Nightly, every D1 table lands in OBCF_R2 as NDJSON under `vault/<appId>/<backupId>/`, and
// the bucket's own objects (uploads, media) are snapshotted beside them: listed per backup,
// their bytes kept once per etag under `vault/<appId>/_objects/`. Platform admins restore
// from `/api/vault/backups/:id/restore`; any signed-in user can take their organization's
// (or their own) rows from `/api/vault/export/me`.
// ============================================================

import { createVault, createVaultPackage, d1Driver } from '@ottabase/vault';
import { getOttabaseConfig } from '../config.loader';
import { resolvePackageCaller } from './caller';

export const vault = createVault<CloudflareEnv>({
    driver: (env) => d1Driver(env.OBCF_D1),
    bucket: (env) => env.OBCF_R2 ?? null,
    appId: (env) => getOttabaseConfig(env).appId,
    // Rendered social images are drawn again on demand: not worth keeping.
    objects: { exclude: ['og/'] },
});

export const vaultPackage = createVaultPackage<CloudflareEnv>({
    vault,
    resolveCaller: resolvePackageCaller,
    env: {
        required: [
            { key: 'OBCF_D1', kind: 'binding', description: 'The database Vault backs up.' },
            { key: 'OBCF_R2', kind: 'binding', description: 'Where backup snapshots are stored.' },
        ],
    },
});
