import type { Router } from '@ottabase/ottarouter';
import { routesOf } from './define';
import type { PackageHost } from './types';

/**
 * Mount every free package's routes on the app router. Premium packages are skipped: the
 * premium registry mounts those behind its license gate (`mountPremiumPackages`).
 *
 * Returns the mounted base paths, for the boot log and for tests.
 */
export function mountPackages<Env>(router: Router<Env>, host: PackageHost<Env>): string[] {
    const mounted: string[] = [];
    for (const pkg of host.packages.packages) {
        if (pkg.premium) continue;
        for (const route of routesOf(pkg)) {
            if (route.before) {
                router.use(route.basePath, route.before);
            }
            router.mount(route.basePath, route.build(host), route.when ? { when: route.when } : undefined);
            mounted.push(route.basePath);
        }
    }
    return mounted;
}
