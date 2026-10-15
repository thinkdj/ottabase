import { createKvStateStore, createPremiumRegistry, isPremiumPackage, type PremiumRegistry } from '@ottabase/premium';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { packages } from '../../ottabase/packages';

/**
 * The licensing facet over the premium packages in the ONE list (ottabase/packages.ts).
 * Their tables, models and policies are collected by the kernel registry like any other
 * package's; this registry owns their license state, entitlements and lifecycle, and
 * mounts their routes behind the license gate (see worker/routes/router.ts).
 */
export const premium: PremiumRegistry<CloudflareEnv> = createPremiumRegistry<CloudflareEnv>({
    packages: packages.packages.filter(isPremiumPackage),
    appId: (env) => getOttabaseConfig(env).appId,
    cacheKey: (env) => {
        const config = getOttabaseConfig(env);
        return `${config.appId}:${config.storage.prefix}`;
    },
    getStore: (env) =>
        env?.OBCF_KV
            ? createKvStateStore(env.OBCF_KV as never, `${getOttabaseConfig(env).storage.prefix}:premium:`)
            : null,
});
