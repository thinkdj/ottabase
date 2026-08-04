// ============================================================
// @ottabase/premium — manifest definition
// ============================================================

import type { PremiumPackage } from './types';

/** Package keys are used in env var names, API paths and license claims — keep them boring. */
const PACKAGE_KEY_RE = /^[a-z][a-z0-9-]{1,48}$/;

/**
 * Declare a paid package.
 *
 * Validation happens HERE, at module load, rather than at first request: a typo in a
 * `basePath` or a key should break the build that introduced it, not the first customer
 * request that happens to touch the route.
 *
 * @example
 * ```typescript
 * import { definePremiumPackage } from '@ottabase/premium';
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
 *     routes: { basePath: '/api/reports', build: () => createReportsRouter() },
 *     lifecycle: {
 *         onInstall: async ({ env }) => seedDefaultReport(env),
 *     },
 * });
 * ```
 */
export function definePremiumPackage<Env = unknown>(pkg: PremiumPackage<Env>): PremiumPackage<Env> {
    if (!PACKAGE_KEY_RE.test(pkg.key)) {
        throw new Error(
            `[premium] Invalid package key "${pkg.key}". Use lowercase letters, digits and hyphens (e.g. "scheduled-reports").`,
        );
    }
    if (!pkg.name?.trim()) {
        throw new Error(`[premium] Package "${pkg.key}" is missing a display name.`);
    }
    if (!pkg.version?.trim()) {
        throw new Error(`[premium] Package "${pkg.key}" is missing a version.`);
    }
    if (pkg.routes && !pkg.routes.basePath.startsWith('/')) {
        throw new Error(
            `[premium] Package "${pkg.key}" route basePath must start with "/" (got "${pkg.routes.basePath}").`,
        );
    }
    // A limit that no plan can raise is a hard-coded constant wearing a gate's clothes.
    // Catching it here is cheap; discovering it from a support ticket is not.
    for (const [limitKey, value] of Object.entries(pkg.freeLimits ?? {})) {
        if (!Number.isFinite(value)) {
            throw new Error(`[premium] Package "${pkg.key}" declares a non-numeric free limit "${limitKey}".`);
        }
    }
    return pkg;
}
