import type { HealthCheck, HealthReport, PackageRegistry } from './types';

function isPresent(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
}

/**
 * One report for the whole app: every package's required env, then every package's own
 * probe. A probe that throws becomes a failed check named after the package; it never
 * takes the report down with it.
 */
export async function runHealth<Env>(registry: PackageRegistry<Env>, env: Env): Promise<HealthReport> {
    const checks: HealthReport['checks'] = [];
    const bag = (env ?? {}) as Record<string, unknown>;

    for (const pkg of registry.packages) {
        for (const key of pkg.env?.required ?? []) {
            checks.push({ package: pkg.key, name: `env:${key}`, ok: isPresent(bag[key]) });
        }
    }

    const probes = registry.packages
        .filter((pkg) => typeof pkg.health === 'function')
        .map(async (pkg) => {
            try {
                const result = await pkg.health!(env);
                const list: HealthCheck[] = Array.isArray(result) ? result : [result];
                return list.map((check) => ({ ...check, package: pkg.key }));
            } catch (error) {
                return [
                    {
                        package: pkg.key,
                        name: 'probe',
                        ok: false,
                        detail: error instanceof Error ? error.name : 'probe threw',
                    },
                ];
            }
        });
    for (const list of await Promise.all(probes)) checks.push(...list);

    return { ok: checks.every((check) => check.ok), checks };
}
