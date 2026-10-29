// ============================================================
// @ottabase/vault — the manifest (a free package)
// ============================================================
// Manual backup, restore, delete and tenant export, plus the nightly schedule with
// retention and a staleness health check. Everything is on; nothing is licensed.
// ============================================================

import {
    definePackage,
    type EnvContribution,
    type HealthCheck,
    type HealthProbe,
    type OttaPackage,
} from '@ottabase/kernel';
import {
    DEFAULT_RETENTION_DAYS,
    DEFAULT_SCHEDULE,
    DEFAULT_STALE_AFTER_HOURS,
    VAULT_BACKUP_HANDLER,
    VAULT_BASE_PATH,
    VAULT_PACKAGE_KEY,
} from './constants';
import { assertCount, createVaultRouter, type VaultRouterOptions } from './routes';

export interface VaultPackageOptions<Env> extends VaultRouterOptions<Env> {
    /** Default `/api/vault`. */
    basePath?: string;
    /** Cron for the scheduled backup. Default `23 2 * * *`. */
    schedule?: string;
    /** Backups older than this are pruned after each scheduled run (the newest is always kept). Default 30. */
    retentionDays?: number;
    /** Health reports not-ok when the newest backup is older than this. Default 48. */
    staleAfterHours?: number;
    /** Env this deployment of the package reads, for the health report. */
    env?: EnvContribution;
    /** Replace the built-in staleness probe. */
    health?: HealthProbe<Env>;
}

/** The vault package as the app registers it: its routes, the nightly backup, and a staleness health check. */
export function createVaultPackage<Env = unknown>(options: VaultPackageOptions<Env>): OttaPackage<Env> {
    const {
        vault,
        resolveCaller,
        requireAdmin,
        tenantColumn,
        userColumn,
        maxManualBackups,
        minBackupIntervalMinutes,
        basePath = VAULT_BASE_PATH,
        schedule = DEFAULT_SCHEDULE,
        retentionDays = DEFAULT_RETENTION_DAYS,
        staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
        env,
        health,
    } = options;
    assertCount('retentionDays', retentionDays, 1);
    if (maxManualBackups !== undefined) assertCount('maxManualBackups', maxManualBackups);
    if (minBackupIntervalMinutes !== undefined) assertCount('minBackupIntervalMinutes', minBackupIntervalMinutes);

    const probe = async (requestEnv: Env): Promise<HealthCheck> => {
        try {
            const [latest] = await vault.list(requestEnv, 1);
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
        description:
            'D1 backups to R2 as NDJSON with one-transaction restore, a nightly schedule with retention, and tenant export.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/vault#readme',

        routes: {
            basePath,
            build: () =>
                createVaultRouter<Env>({
                    vault,
                    resolveCaller,
                    requireAdmin,
                    tenantColumn,
                    userColumn,
                    maxManualBackups,
                    minBackupIntervalMinutes,
                }),
        },

        cron: {
            [VAULT_BACKUP_HANDLER]: {
                description: `Back up every table to the bucket, then prune backups older than the retention window (payload retentionDays, default ${retentionDays}).`,
                handler: async ({ env: requestEnv, payload }) => {
                    await vault.backup(requestEnv, { label: 'scheduled', trigger: 'scheduled' });
                    const keep =
                        payload &&
                        typeof payload === 'object' &&
                        typeof (payload as { retentionDays?: unknown }).retentionDays === 'number'
                            ? (payload as { retentionDays: number }).retentionDays
                            : retentionDays;
                    await vault.prune(requestEnv, keep);
                },
                schedule,
                payload: { retentionDays },
            },
        },

        nav: [
            {
                title: 'Vault',
                description: 'Backups to R2, restore, and per-tenant export.',
                href: '/admin/infrastructure/vault',
                icon: 'Archive',
                scope: 'platform',
                group: 'infrastructure',
            },
        ],

        ...(env ? { env } : {}),
        health: health ?? probe,

        lifecycle: {
            onInstall: ({ key, version }) => {
                console.info(`[vault] installed ${key} v${version}`);
            },
        },
    });
}
