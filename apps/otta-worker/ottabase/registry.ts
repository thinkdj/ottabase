// ============================================================
// The package registry — the holder, apart from the list
// ============================================================
// Same two-file split as otta-web, for the same reason: modules that can sit inside a
// manifest's import graph (db-utils, the queue, route code) import `packages` from HERE,
// which imports no manifest; entry-ish modules (the Worker entry, cron) import
// `./packages`, which loads the manifests and hands the list over.
// ============================================================

import { createPackageRegistry, type OttaPackage, type PackageRegistry } from '@ottabase/kernel';
import { events } from './events';

type PackageList = () => Array<OttaPackage<CloudflareEnv>>;

let list: PackageList | null = null;
let registry: PackageRegistry<CloudflareEnv> | null = null;

/** Called once, by `ottabase/packages.ts`, as it loads. */
export function definePackageList(packages: PackageList): void {
    list = packages;
    registry = null;
}

function resolved(): PackageRegistry<CloudflareEnv> {
    if (!registry) {
        if (!list) {
            throw new Error(
                '[ottabase] The package list has not been loaded. Import "ottabase/packages" (the Worker entry does) before using the registry.',
            );
        }
        registry = createPackageRegistry<CloudflareEnv>({ packages: list() });
        events.subscribe(registry.events());
    }
    return registry;
}

export const packages: PackageRegistry<CloudflareEnv> = {
    get packages() {
        return resolved().packages;
    },
    has: (key) => resolved().has(key),
    get: (key) => resolved().get(key),
    keys: () => resolved().keys(),
    installed: () => resolved().installed(),
    tables: () => resolved().tables(),
    migrations: () => resolved().migrations(),
    suppressIndexes: () => resolved().suppressIndexes(),
    models: () => resolved().models(),
    policies: () => resolved().policies(),
    routes: () => resolved().routes(),
    cron: () => resolved().cron(),
    queue: () => resolved().queue(),
    events: () => resolved().events(),
    nav: () => resolved().nav(),
    env: () => resolved().env(),
    report: (incident) => resolved().report(incident),
};
