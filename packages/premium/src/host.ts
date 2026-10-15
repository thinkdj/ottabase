// ============================================================
// @ottabase/premium — reading the premium registry out of the package host
// ============================================================

import type { OttaPackage, PackageHost } from '@ottabase/kernel';
import type { PremiumRegistry } from './registry';
import type { PremiumPackage } from './types';

/**
 * The premium registry a package's routes were mounted by. `mountPremiumPackages()` puts
 * it on the host; a package built outside that call (a unit test mounting the router by
 * hand) gets a clear error instead of an undefined registry at the first gate.
 */
export function premiumRegistryOf<Env>(host: PackageHost<Env>): PremiumRegistry<Env> {
    if (!host.premium) {
        throw new Error(
            '[premium] This route was built without a premium registry. Mount it with mountPremiumPackages(), which sets host.premium.',
        );
    }
    return host.premium as PremiumRegistry<Env>;
}

/** Narrow a kernel package to a Premium Package: what `createPremiumRegistry` should be given. */
export function isPremiumPackage<Env>(pkg: OttaPackage<Env>): pkg is OttaPackage<Env> & PremiumPackage<Env> {
    return pkg.premium === true;
}
