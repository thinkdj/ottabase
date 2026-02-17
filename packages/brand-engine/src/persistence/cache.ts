// ---------------------------------------------------------------------------
// Brand Engine – KV caching for resolved brand config
// Caches BrandResolutionCache (route mappings + brand kits + layouts) per org/app/mode
// ---------------------------------------------------------------------------

import type { KVNamespace } from '@cloudflare/workers-types';
import { orgAppKey } from '@ottabase/cf/cache-keys';
import type { BrandResolutionCache } from './types';

const CACHE_TTL = 60 * 60; // 1 hour

export interface BrandCacheClient {
    getResolutionData(orgId: string | null, appId?: string | null, mode?: string): Promise<BrandResolutionCache | null>;
    setResolutionData(
        orgId: string | null,
        appId: string | null | undefined,
        mode: string,
        data: BrandResolutionCache,
    ): Promise<void>;
    invalidate(organizationId: string | null, appId?: string | null): Promise<void>;
}

/**
 * Build cache key for brand resolution data
 * Format: brand:org:{orgId}:app:{appId}:resolved:{mode}
 * Example: brand:org:acme:app:web:resolved:light
 */
function getKey(orgId: string | null, appId?: string | null, mode?: string): string {
    const effectiveOrgId = orgId || 'default';
    const effectiveAppId = appId || 'default';
    const effectiveMode = mode || 'light';

    return orgAppKey('brand', effectiveOrgId, effectiveAppId, 'resolved', effectiveMode);
}

export function createBrandCache(kv: KVNamespace): BrandCacheClient {
    return {
        async getResolutionData(organizationId, appId, mode) {
            const key = getKey(organizationId, appId, mode);
            const cached = await kv.get(key, { type: 'json' });
            return cached as BrandResolutionCache | null;
        },

        async setResolutionData(organizationId, appId, mode, data) {
            const key = getKey(organizationId, appId, mode);
            await kv.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
        },

        async invalidate(organizationId, appId) {
            // Invalidate all variants: dual-mode ('all') + legacy per-mode caches
            for (const m of ['all', 'light', 'dark'] as const) {
                await kv.delete(getKey(organizationId, appId, m));
                if (appId) await kv.delete(getKey(organizationId, null, m));
                if (organizationId) await kv.delete(getKey(null, null, m));
            }
        },
    };
}
