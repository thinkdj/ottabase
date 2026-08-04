// ============================================================
// @ottabase/premium — manifest collection
// ============================================================
// Pure functions over a list of manifests, with no registry and no env.
//
// They exist because the host needs a package's TABLES at points where no request env
// exists to verify a license against: `drizzle-kit push`, the auto-migration collector,
// and the synchronous model-registry bootstrap. Requiring a registry there would mean
// building the whole runtime — auth included — just to answer "which tables exist".
// ============================================================

import type { PremiumNavItem, PremiumPackage } from './types';

function enabled<Env>(packages: ReadonlyArray<PremiumPackage<Env>>, disabled?: readonly string[]) {
    if (!disabled?.length) return packages;
    const off = new Set(disabled);
    return packages.filter((pkg) => !off.has(pkg.key));
}

/** Every table contributed by the given packages, merged into one object. */
export function collectPremiumTables<Env>(
    packages: ReadonlyArray<PremiumPackage<Env>>,
    disabled?: readonly string[],
): Record<string, unknown> {
    const tables: Record<string, unknown> = {};
    for (const pkg of enabled(packages, disabled)) Object.assign(tables, pkg.tables ?? {});
    return tables;
}

/** Every migration contributed by the given packages, in registration order. */
export function collectPremiumMigrations<Env>(
    packages: ReadonlyArray<PremiumPackage<Env>>,
    disabled?: readonly string[],
): unknown[] {
    return enabled(packages, disabled).flatMap((pkg) => pkg.migrations ?? []);
}

/** Every model class contributed by the given packages. */
export function collectPremiumModels<Env>(
    packages: ReadonlyArray<PremiumPackage<Env>>,
    disabled?: readonly string[],
): unknown[] {
    return enabled(packages, disabled).flatMap((pkg) => pkg.models ?? []);
}

/** Every RLS policy contributed by the given packages. */
export function collectPremiumPolicies<Env>(
    packages: ReadonlyArray<PremiumPackage<Env>>,
    disabled?: readonly string[],
): unknown[] {
    return enabled(packages, disabled).flatMap((pkg) => pkg.policies ?? []);
}

/** Every nav entry, tagged with the package that contributed it. */
export function collectPremiumNav<Env>(
    packages: ReadonlyArray<PremiumPackage<Env>>,
    disabled?: readonly string[],
): Array<PremiumNavItem & { packageKey: string }> {
    return enabled(packages, disabled).flatMap((pkg) =>
        (pkg.nav ?? []).map((item) => ({ ...item, packageKey: pkg.key })),
    );
}
