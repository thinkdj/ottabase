// ============================================================
// @ottabase/premium — manifest definition
// ============================================================

import { definePackage, type OttaPackage } from '@ottabase/kernel';
import type { PremiumPackage, PremiumPackageInput } from './types';

/**
 * Declare a Premium Package.
 *
 * Validation happens HERE, at module load, rather than at first request: a typo in a
 * `basePath` or a key should break the build that introduced it, not the first customer
 * request that happens to touch the route. The kernel validates the package half; this
 * validates the commercial half and stamps the `premium` marker.
 *
 * @example
 * ```typescript
 * import { definePremiumPackage, premiumRegistryOf } from '@ottabase/premium';
 * import { reportsTable } from './schema';
 * import { createReportsRouter } from './routes';
 *
 * export const reportsPackage = definePremiumPackage({
 *     key: 'reports',
 *     name: 'Scheduled Reports',
 *     version: '1.0.0',
 *     licensePublicKey: 'BFq...',           // vendor's public key
 *     features: ['reports.schedule', 'reports.export'],
 *     freeLimits: { reports: 1 },           // what an unlicensed install still gets
 *     tables: { reportsTable },
 *     routes: { basePath: '/api/reports', build: (host) => createReportsRouter(premiumRegistryOf(host)) },
 *     lifecycle: {
 *         onInstall: async ({ env }) => seedDefaultReport(env),
 *     },
 * });
 * ```
 */
export function definePremiumPackage<Env = unknown>(pkg: PremiumPackageInput<Env>): PremiumPackage<Env> {
    // The premium route and lifecycle shapes are structurally valid kernel ones (the kernel
    // declares its hooks as methods for exactly this reason), so the kernel can check them.
    definePackage<Env>(pkg as unknown as OttaPackage<Env>);
    // A limit that no plan can raise is a hard-coded constant wearing a gate's clothes.
    // Catching it here is cheap; discovering it from a support ticket is not.
    for (const [limitKey, value] of Object.entries(pkg.freeLimits ?? {})) {
        if (!Number.isFinite(value)) {
            throw new Error(`[premium] Package "${pkg.key}" declares a non-numeric free limit "${limitKey}".`);
        }
    }
    return { ...pkg, premium: true };
}
