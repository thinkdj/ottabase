import { definePackage, type HealthCheck, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { createVaultRouter, type VaultRouterOptions } from './routes';

export const VAULT_PACKAGE_KEY = 'vault';
export const VAULT_BASE_PATH = '/api/vault';
export const VAULT_BACKUP_HANDLER = 'vault:backup';
export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_STALE_AFTER_HOURS = 48;

export interface VaultPackageOptions<Env> extends VaultRouterOptions<Env>, PackageExtras<Env> {
    /** Default `/api/vault`. */
    basePath?: string;
    /** Cron for the scheduled backup. Default `23 2 * * *`. */
    schedule?: string;
    /** Backups older than this are pruned after each scheduled run (the newest is always kept). Default 30. */
    retentionDays?: number;
    /** Health reports not-ok when the newest backup is older than this. Default 48. */
    staleAfterHours?: number;
}

/** The vault package as the app registers it: admin routes, the nightly backup, and a staleness health check. */
export function createVaultPackage<Env = unknown>(options: VaultPackageOptions<Env>): OttaPackage<Env> {
    const {
        vault,
        resolveCaller,
        requireAdmin,
        tenantColumn,
        userColumn,
        basePath = VAULT_BASE_PATH,
        schedule = '23 2 * * *',
        retentionDays = DEFAULT_RETENTION_DAYS,
        staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
        cron,
        health,
        ...extras
    } = options;

    const probe = async (env: Env): Promise<HealthCheck> => {
        try {
            const [latest] = await vault.list(env, 1);
            if (!latest) return { name: 'vault:latest-backup', ok: false, detail: 'no backup yet' };
            const ageHours = (Date.now() - Date.parse(latest.createdAt)) / 3_600_000;
            return {
                name: 'vault:latest-backup',
                ok: ageHours <= staleAfterHours,
                detail: `${latest.id} (${ageHours.toFixed(1)}h ago, ${latest.tables.length} tables)`,
            };
        } catch (error) {
            return { name: 'vault:bucket', ok: false, detail: error instanceof Error ? error.message : String(error) };
        }
    };

    return definePackage<Env>({
        key: VAULT_PACKAGE_KEY,
        name: 'Vault',
        version: '1.0.0',
        description: 'Scheduled D1 backups to R2 as NDJSON, one-transaction restore, and per-tenant export.',
        routes: {
            basePath,
            build: () => createVaultRouter<Env>({ vault, resolveCaller, requireAdmin, tenantColumn, userColumn }),
        },
        cron: {
            [VAULT_BACKUP_HANDLER]: {
                description: `Back up every table to the bucket, then prune backups older than the retention window (payload retentionDays, default ${retentionDays}).`,
                handler: async ({ env, payload }) => {
                    await vault.backup(env, { label: 'scheduled' });
                    const keep =
                        payload &&
                        typeof payload === 'object' &&
                        typeof (payload as { retentionDays?: unknown }).retentionDays === 'number'
                            ? (payload as { retentionDays: number }).retentionDays
                            : retentionDays;
                    await vault.prune(env, keep);
                },
                schedule,
                payload: { retentionDays },
            },
            ...cron,
        },
        health: health ?? probe,
        ...extras,
    });
}
