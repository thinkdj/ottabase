// ---------------------------------------------------------------------------
// Shared warm-cache helper for brand mutation handlers
// ---------------------------------------------------------------------------

import { createBrandCache } from '../persistence/cache';
import { resolveFullBrandConfig } from '../persistence/resolveBrandConfig';
import type { BrandApiEnv } from './brand-api';

/**
 * Invalidate stale brand cache, then eagerly re-resolve to keep cache warm.
 * Single dual-mode call: resolveFullBrandConfig resolves both light+dark per kit.
 */
export async function warmBrandCache(
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<void> {
    const cache = createBrandCache(env.OBCF_KV);
    await cache.invalidate(organizationId, appId);
    // Single call resolves both modes (light + dark themes per kit)
    await resolveFullBrandConfig(env, { organizationId, appId });
}
