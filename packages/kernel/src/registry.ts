import type { Subscription } from '@ottabase/events';
import type { Migration, ModelRLSConfig } from '@ottabase/ottaorm';
import type { JobHandler } from '@ottabase/queue';
import { routesOf } from './define';
import type {
    CronContribution,
    ModelEntry,
    NavContribution,
    OttaPackage,
    PackageRegistry,
    RouteContribution,
} from './types';

export interface PackageRegistryOptions<Env> {
    packages: Array<OttaPackage<Env>>;
}

function assertUnique(kind: string, owners: Map<string, string>, name: string, owner: string): void {
    const existing = owners.get(name);
    if (existing && existing !== owner) {
        throw new Error(
            `[kernel] ${kind} "${name}" is contributed by both "${existing}" and "${owner}". Namespace it (e.g. "${owner}:${name}").`,
        );
    }
    owners.set(name, owner);
}

/**
 * Collect everything the installed packages contribute, once, at module load. Every
 * clash that would otherwise surface as "the wrong table won" or "the other package's
 * handler ran" throws here instead, with both package names in the message.
 */
export function createPackageRegistry<Env = unknown>(options: PackageRegistryOptions<Env>): PackageRegistry<Env> {
    const packages = [...options.packages];
    const byKey = new Map<string, OttaPackage<Env>>();
    for (const pkg of packages) {
        if (byKey.has(pkg.key)) {
            throw new Error(`[kernel] Duplicate package key "${pkg.key}": each package may be registered once.`);
        }
        byKey.set(pkg.key, pkg);
    }

    // Collected eagerly: clashes should fail at boot, not on the first request that hits them.
    const tables: Record<string, unknown> = {};
    const tableOwners = new Map<string, string>();
    const cron: Record<string, CronContribution<Env> & { packageKey: string }> = {};
    const cronOwners = new Map<string, string>();
    const queue: Record<string, JobHandler<never, Env>> = {};
    const queueOwners = new Map<string, string>();
    for (const pkg of packages) {
        for (const [name, table] of Object.entries(pkg.tables ?? {})) {
            assertUnique('Table', tableOwners, name, pkg.key);
            tables[name] = table;
        }
        for (const [name, job] of Object.entries(pkg.cron ?? {})) {
            assertUnique('Cron handler', cronOwners, name, pkg.key);
            cron[name] = { ...job, packageKey: pkg.key };
        }
        for (const [type, handler] of Object.entries(pkg.queue ?? {})) {
            assertUnique('Queue job type', queueOwners, type, pkg.key);
            queue[type] = handler;
        }
    }

    const flat = <T>(pick: (pkg: OttaPackage<Env>) => T[] | undefined): T[] =>
        packages.flatMap((pkg) => pick(pkg) ?? []);

    return {
        packages,
        has: (key) => byKey.has(key),
        get: (key) => byKey.get(key) ?? null,
        keys: () => packages.map((pkg) => pkg.key),
        installed: () => Object.fromEntries(packages.map((pkg) => [pkg.key, true])),

        tables: () => ({ ...tables }),
        migrations: () => flat<Migration>((pkg) => pkg.migrations),
        suppressIndexes: () => [...new Set(flat<string>((pkg) => pkg.suppressIndexes))],
        models: () => flat<ModelEntry>((pkg) => pkg.models),
        policies: () => flat<ModelRLSConfig>((pkg) => pkg.policies),
        routes: () =>
            packages.flatMap((pkg) =>
                routesOf(pkg).map((route): RouteContribution<Env> & { packageKey: string } => ({
                    ...route,
                    packageKey: pkg.key,
                })),
            ),
        cron: () => ({ ...cron }),
        queue: () => ({ ...queue }),
        events: () => flat<Subscription<Env, never>>((pkg) => pkg.events),
        nav: () =>
            packages.flatMap((pkg) =>
                (pkg.nav ?? []).map((item): NavContribution & { packageKey: string } => ({
                    ...item,
                    packageKey: pkg.key,
                })),
            ),
        env: () => ({
            required: [...new Set(flat<string>((pkg) => pkg.env?.required))],
            optional: [...new Set(flat<string>((pkg) => pkg.env?.optional))],
        }),
    };
}
