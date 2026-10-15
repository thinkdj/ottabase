import type { OttaPackage, RouteContribution } from './types';

export const PACKAGE_KEY_RE = /^[a-z][a-z0-9-]{1,48}$/;

export function routesOf<Env>(pkg: OttaPackage<Env>): Array<RouteContribution<Env>> {
    if (!pkg.routes) return [];
    return Array.isArray(pkg.routes) ? pkg.routes : [pkg.routes];
}

/**
 * Validate a manifest at definition time, so a typo fails the build, not a request.
 * Returns the same object: `definePackage` is a checked identity function.
 */
export function definePackage<Env = unknown>(pkg: OttaPackage<Env>): OttaPackage<Env> {
    if (!PACKAGE_KEY_RE.test(pkg.key)) {
        throw new Error(
            `[kernel] Invalid package key "${pkg.key}". Use lowercase letters, digits and hyphens (e.g. "scheduled-reports").`,
        );
    }
    if (!pkg.name?.trim()) throw new Error(`[kernel] Package "${pkg.key}" is missing a display name.`);
    if (!pkg.version?.trim()) throw new Error(`[kernel] Package "${pkg.key}" is missing a version.`);

    for (const route of routesOf(pkg)) {
        if (!route.basePath.startsWith('/')) {
            throw new Error(
                `[kernel] Package "${pkg.key}" route basePath must start with "/" (got "${route.basePath}").`,
            );
        }
        if (typeof route.build !== 'function') {
            throw new Error(`[kernel] Package "${pkg.key}" route "${route.basePath}" has no build() function.`);
        }
    }
    for (const tableName of Object.keys(pkg.tables ?? {})) {
        // `collectTableSchemas` only picks up keys ending in `Table`; anything else is silently
        // skipped by auto-init, which is the worst kind of bug to find in production.
        if (!tableName.endsWith('Table')) {
            throw new Error(
                `[kernel] Package "${pkg.key}" exports table "${tableName}"; table keys must end in "Table" to reach auto-init.`,
            );
        }
    }
    for (const [name, job] of Object.entries(pkg.cron ?? {})) {
        if (typeof job.handler !== 'function') {
            throw new Error(`[kernel] Package "${pkg.key}" cron handler "${name}" is not a function.`);
        }
        if (!job.description?.trim()) {
            throw new Error(
                `[kernel] Package "${pkg.key}" cron handler "${name}" needs a description (shown in the admin).`,
            );
        }
    }
    for (const item of pkg.nav ?? []) {
        if (!item.href.startsWith('/')) {
            throw new Error(`[kernel] Package "${pkg.key}" nav href must start with "/" (got "${item.href}").`);
        }
    }
    return pkg;
}
