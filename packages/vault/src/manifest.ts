// ============================================================
// @ottabase/vault — the manifest (a Premium Package)
// ============================================================
// Free tier: manual backup, list, restore and delete, up to five kept backups. Nobody is
// ever locked out of recovering their own data. A license unlocks the nightly schedule
// with retention, the staleness health check, and operator export of any tenant.
//
// The premium registry reaches this package at MOUNT TIME (`routes.build(host)`), and the
// cron handler and the health probe need it too. So `build()` keeps it in a closure: the
// schedule can only verify a license once the routes are mounted, which every host that
// calls `mountPremiumPackages()` does at module init, long before the first tick.
// ============================================================

import type { EnvContribution, HealthCheck, HealthProbe } from '@ottabase/kernel';
import { definePremiumPackage, premiumRegistryOf, type PremiumPackage, type PremiumRegistry } from '@ottabase/premium';
import {
    DEFAULT_RETENTION_DAYS,
    DEFAULT_SCHEDULE,
    DEFAULT_STALE_AFTER_HOURS,
    VAULT_BACKUP_HANDLER,
    VAULT_BASE_PATH,
    VAULT_FEATURE_BACKUP,
    VAULT_FEATURE_EXPORT,
    VAULT_FEATURE_SCHEDULE,
    VAULT_FREE_BACKUP_LIMIT,
    VAULT_LIMIT_BACKUPS,
    VAULT_PACKAGE_KEY,
} from './constants';
import { DEMO_LICENSE_PUBLIC_KEY } from './demo-license';
import { createVaultRouter, type VaultRouterOptions } from './routes';

export interface VaultPackageOptions<Env> extends Omit<VaultRouterOptions<Env>, 'registry'> {
    /** Default `/api/vault`. */
    basePath?: string;
    /** Cron for the scheduled backup. Default `23 2 * * *`. */
    schedule?: string;
    /** Backups older than this are pruned after each scheduled run (the newest is always kept). Default 30. */
    retentionDays?: number;
    /** Health reports not-ok when the newest backup is older than this. Default 48. */
    staleAfterHours?: number;
    /**
     * Vendor public key. Defaults to the DEMO key published in this repository; replace it
     * (and the license) for anything you sell.
     */
    licensePublicKey?: string;
    /** Where the upsell sends people. */
    purchaseUrl?: string;
    /** Env this deployment of the package reads, for the health report. */
    env?: EnvContribution;
    /** Replace the built-in staleness probe. */
    health?: HealthProbe<Env>;
}

/** The vault package as the app registers it: gated routes, the nightly backup, and a staleness health check. */
export function createVaultPackage<Env = unknown>(options: VaultPackageOptions<Env>): PremiumPackage<Env> {
    const {
        vault,
        resolveCaller,
        requireAdmin,
        tenantColumn,
        userColumn,
        basePath = VAULT_BASE_PATH,
        schedule = DEFAULT_SCHEDULE,
        retentionDays = DEFAULT_RETENTION_DAYS,
        staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
        licensePublicKey = DEMO_LICENSE_PUBLIC_KEY,
        purchaseUrl = 'https://github.com/thinkdj/ottabase/tree/main/packages/vault#licensing',
        env,
        health,
    } = options;

    let registry: PremiumRegistry<Env> | null = null;

    const scheduleEntitled = async (requestEnv: Env): Promise<boolean> =>
        registry ? (await registry.feature(requestEnv, VAULT_PACKAGE_KEY, VAULT_FEATURE_SCHEDULE)).allowed : false;

    const probe = async (requestEnv: Env): Promise<HealthCheck> => {
        if (!registry) {
            return {
                name: 'vault:schedule',
                ok: false,
                detail: 'routes are not mounted; mount with mountPremiumPackages() so the schedule can verify its license',
            };
        }
        if (!(await scheduleEntitled(requestEnv))) {
            return {
                name: 'vault:schedule',
                ok: true,
                detail: 'free tier: manual backups only; a license adds the nightly schedule and retention',
            };
        }
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

    return definePremiumPackage<Env>({
        key: VAULT_PACKAGE_KEY,
        name: 'Vault',
        version: '1.0.0',
        description:
            'D1 backups to R2 as NDJSON with one-transaction restore; a license adds the nightly schedule, retention and tenant export.',
        vendor: 'Ottabase',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/vault#readme',
        purchaseUrl,

        licensePublicKey,
        graceDays: 14,

        features: [VAULT_FEATURE_BACKUP, VAULT_FEATURE_SCHEDULE, VAULT_FEATURE_EXPORT],
        // The free tier is the part that gets a founder out of trouble: a backup before a
        // risky migration and the restore after it. What is sold is not having to remember.
        freeFeatures: [VAULT_FEATURE_BACKUP],
        freeLimits: { [VAULT_LIMIT_BACKUPS]: VAULT_FREE_BACKUP_LIMIT },

        routes: {
            basePath,
            // `entitlements`, not `license`: the free tier lives behind these routes, so the
            // namespace stays reachable and the paid paths guard themselves (see routes.ts).
            gate: 'entitlements',
            build: (host) => {
                registry = premiumRegistryOf<Env>(host);
                return createVaultRouter<Env>({
                    vault,
                    resolveCaller,
                    requireAdmin,
                    tenantColumn,
                    userColumn,
                    registry,
                });
            },
        },

        cron: {
            [VAULT_BACKUP_HANDLER]: {
                description: `Back up every table to the bucket, then prune backups older than the retention window (payload retentionDays, default ${retentionDays}). Runs only with a license that includes the schedule.`,
                handler: async ({ env: requestEnv, payload }) => {
                    if (!(await scheduleEntitled(requestEnv))) {
                        console.warn(
                            JSON.stringify({
                                event: 'vault_schedule_skipped',
                                reason: registry ? 'unlicensed' : 'routes not mounted',
                            }),
                        );
                        return;
                    }
                    await vault.backup(requestEnv, { label: 'scheduled' });
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
            onDeactivate: ({ reason }) => {
                // Backups are LEFT ALONE: a lapsed license closes the schedule, never the data.
                console.warn(`[vault] license inactive (${reason}); the nightly schedule is paused, backups stay`);
            },
        },
    });
}
