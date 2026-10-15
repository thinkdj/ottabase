// ============================================================
// @ottabase/premium/server — mounting paid routes
// ============================================================
// One call wires every registered package's routes into the host router, each behind
// its own license gate:
//
//     mountPremiumPackages(apiRouter, premium, { packages });
//
// The gate is MIDDLEWARE, not a `when` mount gate, and that is a load-bearing choice:
// license verification is async (Web Crypto), while ottarouter's `when` gate is sync.
// Middleware also runs when no route under the prefix matches, so an unlicensed package
// answers 402 for its whole namespace instead of leaking a 404 map of what exists.
// ============================================================

import { createPackageRegistry, type PackageHost, type PackageRegistry } from '@ottabase/kernel';
import type { Ctx, Router } from '@ottabase/ottarouter';
import type { PremiumRegistry } from '../registry';
import { premiumDeniedResponse, requirePremium } from './guard';

export interface MountPremiumOptions<Env> {
    /**
     * The app's kernel registry, so a paid package's routes can see what else is installed.
     * Defaults to a registry of just the premium packages.
     */
    packages?: PackageRegistry<Env>;
    /**
     * Runs BEFORE the license gate for every paid route. Use it for session/permission
     * checks that should answer 401/403 rather than advertising 402 to anonymous callers.
     */
    beforeGate?: (c: Ctx<Env>, packageKey: string) => Promise<Response | null> | Response | null;
}

/**
 * Mount every registered package that contributes routes.
 *
 * Returns the base paths that were mounted, so a host can log or assert on them. Packages
 * without a `routes` contribution are skipped silently — plenty of paid add-ons are pure
 * UI or pure model code.
 */
export function mountPremiumPackages<Env>(
    router: Router<Env>,
    registry: PremiumRegistry<Env>,
    options?: MountPremiumOptions<Env>,
): string[] {
    const mounted: string[] = [];
    const host: PackageHost<Env> = {
        packages: options?.packages ?? createPackageRegistry<Env>({ packages: [...registry.packages] }),
        premium: registry,
    };

    for (const pkg of registry.packages) {
        if (!pkg.routes) continue;
        const { basePath, build } = pkg.routes;

        const gateMode = pkg.routes.gate ?? 'license';

        router.use(basePath, async (c, next) => {
            const before = await options?.beforeGate?.(c, pkg.key);
            if (before) return before;

            // `entitlements` mode still refuses an operator-DISABLED package here: "switched
            // off" is not a free tier, and letting those routes through would mean a kill
            // switch that does not kill anything.
            if (gateMode === 'entitlements') {
                const resolution = await registry.resolve(c.env, pkg.key);
                if (!resolution || resolution.license.state === 'disabled') {
                    return premiumDeniedResponse(pkg.key, {
                        allowed: false,
                        upsell: false,
                        reason: resolution ? 'PACKAGE_DISABLED' : 'PACKAGE_UNKNOWN',
                        state: 'disabled',
                    });
                }
                return next();
            }

            const denied = await requirePremium(registry, c.env, pkg.key);
            if (denied) return denied;

            return next();
        });

        router.mount(basePath, build(host));
        mounted.push(basePath);
    }

    return mounted;
}
