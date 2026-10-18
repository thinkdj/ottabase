// ============================================================
// The package registry — the holder, apart from the list
// ============================================================
// `ottabase/packages.ts` is the list of installed manifests; this module is where the
// registry built from it lives. They are two files for one reason: import cycles.
//
// Manifests import route handlers, handlers import `worker/lib/db-utils`, and db-utils
// needs the registry to register models. If db-utils imported the LIST, loading any
// handler first (a unit test, a lib module) would evaluate the manifests before the
// handler they import had finished, and crash on a half-initialised module. So:
//
//   - modules that may sit INSIDE a manifest's import graph (db-utils, the queue registry,
//     route handlers, lib code) import `packages` from HERE, which imports no manifest;
//   - entry-ish modules (the worker entry, the API router, cron, init, bootstrap, premium)
//     import from `./packages`, which loads the manifests and hands the list over.
//
// The registry is built on first use. Using it before the list has loaded is a wiring
// error, and says so, rather than quietly answering "nothing is installed".
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
                '[ottabase] The package list has not been loaded. Import "ottabase/packages" (the worker entry and the router do) before using the registry; a unit test mocks "ottabase/registry" instead.',
            );
        }
        registry = createPackageRegistry<CloudflareEnv>({ packages: list() });
        // Package subscriptions, on the app's bus. Emitting happens wherever the app likes.
        events.subscribe(registry.events());
    }
    return registry;
}

/** The app's package registry. Every member delegates to the registry built on first use. */
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
