// ============================================================
// Premium package registry (worker)
// ============================================================
// One registry per isolate, built from `ottabase/config.premium.ts`. Everything that
// needs entitlement answers — the mounted package routes, the `/api/premium` control
// plane, and any host code calling a gate — goes through this instance so they all share
// one resolution cache and one view of what is licensed.
// ============================================================

import { createKvStateStore, createPremiumRegistry, type PremiumRegistry } from '@ottabase/premium';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { PREMIUM_PACKAGES } from '../../ottabase/config.premium';

/**
 * The registry.
 *
 * Module-level, and safe to be: it holds manifests plus a short-lived resolution cache,
 * both of which are per-isolate by nature. The license itself is re-verified
 * cryptographically on every cache miss, so nothing authoritative is memoized across
 * deployments.
 *
 * `appId` is resolved PER REQUEST ENV, not captured at module load: `APP_ID` is an env
 * override, so a fixed value would verify `appId`-bound licenses against the value in the
 * config file rather than the identity the deployment actually runs under. It never comes
 * from a request header.
 */
export const premium: PremiumRegistry<CloudflareEnv> = createPremiumRegistry<CloudflareEnv>({
    packages: PREMIUM_PACKAGES,
    appId: (env) => getOttabaseConfig(env).appId,
    cacheKey: (env) => {
        const config = getOttabaseConfig(env);
        return `${config.appId}:${config.storage.prefix}`;
    },
    // KV holds install records and admin-activated license keys. A deployment without the
    // binding falls back to an in-memory store, so status reads and lifecycle hooks stay
    // defined instead of throwing on a missing namespace.
    getStore: (env) =>
        env?.OBCF_KV
            ? createKvStateStore(env.OBCF_KV as never, `${getOttabaseConfig(env).storage.prefix}:premium:`)
            : null,
});

/**
 * Model classes contributed by installed Premium Packages.
 *
 * Registered UNCONDITIONALLY at boot, not per license. Model registration is what lets
 * the ORM resolve a table; it exposes nothing on its own, because generic CRUD is
 * default-deny (`GENERIC_CRUD_ALLOWLIST`) and every paid route runs its own gate. Making
 * registration license-dependent would mean an async license check inside the synchronous
 * connection bootstrap — a much worse trade for no extra safety.
 *
 * Tables and migrations are deliberately NOT read from here: `config.migrations.ts`
 * collects them straight from the manifests, so the migration path never has to build a
 * registry (and with it, the auth stack) to answer "which tables exist".
 */
export function getPremiumPackageModels(): unknown[] {
    return premium.models();
}
