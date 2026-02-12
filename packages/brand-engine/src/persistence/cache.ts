// ---------------------------------------------------------------------------
// Brand Engine – KV caching for resolved brand config
// Caches BrandResolutionCache (route mappings + brand kits + layouts) per org/app/mode
// ---------------------------------------------------------------------------

import type { KVNamespace } from '@cloudflare/workers-types';
import type { BrandResolutionCache } from './types';

const CACHE_PREFIX = 'brand:resolved:';
const CACHE_TTL = 60 * 60; // 1 hour

export interface BrandCacheClient {
    getResolutionData(
        orgId: string | null,
        appId?: string | null,
        mode?: 'light' | 'dark',
    ): Promise<BrandResolutionCache | null>;
    setResolutionData(
        orgId: string | null,
        appId: string | null | undefined,
        mode: 'light' | 'dark',
        data: BrandResolutionCache,
    ): Promise<void>;
    invalidate(organizationId: string | null, appId?: string | null): Promise<void>;
}

function getKey(orgId: string | null, appId?: string | null, mode?: 'light' | 'dark') {
    return `${CACHE_PREFIX}${orgId || 'default'}:${appId || 'default'}:${mode || 'light'}`;
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
            for (const m of ['light', 'dark'] as const) {
                await kv.delete(getKey(organizationId, appId, m));
                if (appId) await kv.delete(getKey(organizationId, null, m));
                if (organizationId) await kv.delete(getKey(null, null, m));
            }
        },
    };
}
