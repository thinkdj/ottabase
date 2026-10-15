// ============================================================
// The licensing facet over the premium packages in the ONE list
// ============================================================
// Their tables, models and policies are collected by the kernel registry like any other
// package's; this registry owns their license state, entitlements and lifecycle, and the
// Worker mounts their routes behind the license gate (worker/routes.ts). Licenses come from
// `PREMIUM_LICENSE_<KEY>` / `PREMIUM_LICENSES` env, or from `POST /api/premium/packages/<key>/license`
// with the operator token (stored in OBCF_KV).
// ============================================================

import { createKvStateStore, createPremiumRegistry, isPremiumPackage, type PremiumRegistry } from '@ottabase/premium';
import { getOttabaseConfig } from './config.loader';
import { packages } from './packages';

export const premium: PremiumRegistry<CloudflareEnv> = createPremiumRegistry<CloudflareEnv>({
    packages: packages.packages.filter(isPremiumPackage),
    appId: (env) => getOttabaseConfig(env).appId,
    getStore: (env) =>
        env?.OBCF_KV ? createKvStateStore(env.OBCF_KV as never, `${getOttabaseConfig(env).appId}:premium:`) : null,
});
