// ============================================================
// Vault (@ottabase/vault): backups to R2, restore, per-tenant export
// ============================================================
// Nightly, every D1 table lands in OBCF_R2 as NDJSON under `vault/<appId>/<backupId>/`.
// The operator restores from `/api/vault/backups/:id/restore`. Identical to otta-web's
// composition: that is what `otta add vault <app>` copies.
// ============================================================

import { createVault, createVaultPackage, d1Driver } from '@ottabase/vault';
import { getOttabaseConfig } from '../config.loader';
import { resolvePackageCaller } from './caller';

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
