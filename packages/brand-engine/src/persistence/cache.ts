// ---------------------------------------------------------------------------
// Brand Engine – KV caching for resolved brand config
// Caches full ResolvedBrandConfig for instant edge delivery
// ---------------------------------------------------------------------------

import type { KVNamespace } from '@cloudflare/workers-types';
import type { ResolvedBrandConfig } from './types';

const CACHE_PREFIX = 'brand:resolved:';
const CACHE_TTL = 60 * 60; // 1 hour

export interface BrandCacheClient {
    get(
        orgId: string | null,
        appId?: string | null,
        previewBoxId?: string,
        mode?: 'light' | 'dark',
    ): Promise<ResolvedBrandConfig | null>;
    set(
        orgId: string | null,
        appId: string | null | undefined,
        config: ResolvedBrandConfig,
        previewBoxId?: string,
        mode?: 'light' | 'dark',
    ): Promise<void>;
    invalidate(organizationId: string | null, appId?: string | null, previewBoxId?: string): Promise<void>;
}

export function createBrandCache(kv: KVNamespace): BrandCacheClient {
    const getKey = (orgId: string | null, appId?: string | null, previewBoxId?: string, mode?: 'light' | 'dark') => {
        const parts = [orgId || 'default', appId || 'default', mode || 'light'];
        if (previewBoxId) parts.push(`preview:${previewBoxId}`);
        return `${CACHE_PREFIX}${parts.join(':')}`;
    };

    return {
        async get(organizationId, appId, previewBoxId, mode) {
            const key = getKey(organizationId, appId, previewBoxId, mode);
            const cached = await kv.get(key, { type: 'json' });
            return cached as ResolvedBrandConfig | null;
        },

        async set(organizationId, appId, config, previewBoxId, mode) {
            const key = getKey(organizationId, appId, previewBoxId, mode);
            await kv.put(key, JSON.stringify(config), { expirationTtl: CACHE_TTL });
        },

        async invalidate(organizationId, appId, previewBoxId?: string) {
            for (const m of ['light', 'dark'] as const) {
                await kv.delete(getKey(organizationId, appId, undefined, m));
                if (previewBoxId) await kv.delete(getKey(organizationId, appId, previewBoxId, m));
                if (appId) await kv.delete(getKey(organizationId, null, undefined, m));
                if (organizationId) await kv.delete(getKey(null, null, undefined, m));
            }
        },
    };
}
