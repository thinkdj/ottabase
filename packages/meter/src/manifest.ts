import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { RLSPolicies, type ModelRLSConfig } from '@ottabase/ottaorm';
import { MeterBalance } from './ottaorm-models/MeterBalance';
import { MeterUsage } from './ottaorm-models/MeterUsage';
import { createMeterRouter, type MeterRouterOptions } from './routes';
import { meterBalancesTable, meterUsageTable } from './schema';

export const METER_PACKAGE_KEY = 'meter';
export const METER_BASE_PATH = '/api/meter';
export const METER_PRUNE_HANDLER = 'meter:prune-usage';
export const DEFAULT_USAGE_RETENTION_DAYS = 90;

/** Balances and the ledger are operator tables: app-scoped, platform admins only, writes audited. */
export const meterPolicies: ModelRLSConfig[] = [
    {
        model: 'meter_balances',
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true },
        contextFields: ['appId'],
        auditEnabled: true,
    },
    {
        model: 'meter_usage',
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true, readOnly: true },
        contextFields: ['appId'],
        auditEnabled: false,
    },
];

export interface MeterPackageOptions<Env> extends MeterRouterOptions<Env>, PackageExtras<Env> {
    /** Default `/api/meter`. */
    basePath?: string;
    /** The app id the daily ledger prune works on. */
    appId: (env: Env) => string;
    /** Default 90. */
    usageRetentionDays?: number;
}

/** The meter package as the app registers it: two tables, two models, policies, routes and the ledger prune. */
export function createMeterPackage<Env = unknown>(options: MeterPackageOptions<Env>): OttaPackage<Env> {
    const {
        meter,
        resolveCaller,
        requireAdmin,
        appId,
        basePath = METER_BASE_PATH,
        usageRetentionDays = DEFAULT_USAGE_RETENTION_DAYS,
        cron,
        ...extras
    } = options;
    return definePackage<Env>({
        key: METER_PACKAGE_KEY,
        name: 'Usage credits',
        version: '1.0.0',
        description:
            'Credit balances per tenant and meter, consumed atomically, with periods, top-ups and a usage ledger.',
        tables: { meterBalancesTable, meterUsageTable },
        models: [MeterBalance, MeterUsage],
        policies: meterPolicies,
        routes: {
            basePath,
            build: () => createMeterRouter<Env>({ meter, resolveCaller, requireAdmin }),
        },
        cron: {
            [METER_PRUNE_HANDLER]: {
                description: `Delete credit usage ledger rows older than the retention window (payload olderThanDays, default ${usageRetentionDays}).`,
                handler: async ({ env, payload }) => {
                    const days =
                        payload &&
                        typeof payload === 'object' &&
                        typeof (payload as { olderThanDays?: unknown }).olderThanDays === 'number'
                            ? (payload as { olderThanDays: number }).olderThanDays
                            : usageRetentionDays;
                    await meter.pruneUsage(env, appId(env), days);
                },
                schedule: '41 3 * * *',
                payload: { olderThanDays: usageRetentionDays },
            },
            ...cron,
        },
        ...extras,
    });
}
