import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { RLSPolicies, type ModelRLSConfig } from '@ottabase/ottaorm';
import { FlagOverride } from './ottaorm-models/FlagOverride';
import { createFlagsRouter, type FlagsRouterOptions } from './routes';
import { flagOverridesTable } from './schema';

export const FLAGS_PACKAGE_KEY = 'flags';
export const FLAGS_BASE_PATH = '/api/flags';

/** Overrides are an operator instrument: app-scoped, platform admins only, every write audited. */
export const flagsPolicies: ModelRLSConfig[] = [
    {
        model: 'flag_overrides',
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true },
        contextFields: ['appId'],
        auditEnabled: true,
    },
];

export interface FlagsPackageOptions<Env> extends FlagsRouterOptions<Env>, PackageExtras<Env> {
    /** Default `/api/flags`. */
    basePath?: string;
}

/** The flags package as the app registers it: the overrides table, its model and policy, and the routes. */
export function createFlagsPackage<Env = unknown>(options: FlagsPackageOptions<Env>): OttaPackage<Env> {
    const { flags, resolveCaller, requireAdmin, basePath = FLAGS_BASE_PATH, ...extras } = options;
    return definePackage<Env>({
        key: FLAGS_PACKAGE_KEY,
        name: 'Entitlements',
        version: '1.0.0',
        description: 'Plans with features and limits, operator overrides, and the 402 that sends people to upgrade.',
        tables: { flagOverridesTable },
        models: [FlagOverride],
        policies: flagsPolicies,
        routes: {
            basePath,
            build: () => createFlagsRouter<Env>({ flags, resolveCaller, requireAdmin }),
        },
        ...extras,
    });
}
