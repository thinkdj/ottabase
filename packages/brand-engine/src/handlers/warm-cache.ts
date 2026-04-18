// ---------------------------------------------------------------------------
// Shared warm-cache helper for brand mutation handlers (v2: per-app scoping)
// ---------------------------------------------------------------------------

import { createBrandCache } from '../persistence/cache';
import { resolveFullBrandConfig } from '../persistence/resolveBrandConfig';
import type { BrandApiEnv } from './brand-api';

/** Kit invalidation – appId = kit's app, requestAppId = requesting app (will refetch). */
export type WarmBrandCacheTarget =
    | { kitId: string; appId?: string | null; requestAppId?: string | null }
    | { appId: string | null };

/**
 * Invalidate stale brand cache, then eagerly re-resolve to keep cache warm.
 * For kit updates: pass requestAppId (the app that will refetch) so we invalidate
 * and re-warm its cache – fixes colors/fonts not updating after save.
 */
export async function warmBrandCache(env: BrandApiEnv, target: WarmBrandCacheTarget): Promise<void> {
    const cache = createBrandCache(env.OBCF_KV);
    await cache.invalidate(target);

    // Re-warm for the app that will refetch – requestAppId when editing a kit, else target.appId
    const warmAppId =
        'requestAppId' in target && target.requestAppId != null
            ? target.requestAppId
            : 'appId' in target
              ? target.appId
              : null;
    await resolveFullBrandConfig(env, { appId: warmAppId, skipCache: true }); // FORCE skipCache
}
