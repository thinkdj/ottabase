// ---------------------------------------------------------------------------
// Shared warm-cache helper for brand mutation handlers
// ---------------------------------------------------------------------------

import { createBrandCache } from '../persistence/cache';
import { resolveFullBrandConfig } from '../persistence/resolveBrandConfig';
import type { BrandApiEnv } from './brand-api';

/**
 * Invalidate stale brand cache, then eagerly re-resolve to keep cache warm.
 * Both light and dark mode variants are refreshed so the next request is a cache hit.
 */
export async function warmBrandCache(
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<void> {
    const cache = createBrandCache(env.OBCF_KV);
    await cache.invalidate(organizationId, appId);
    await Promise.all([
        resolveFullBrandConfig(env, { organizationId, appId, mode: 'light' }),
        resolveFullBrandConfig(env, { organizationId, appId, mode: 'dark' }),
    ]);
}
