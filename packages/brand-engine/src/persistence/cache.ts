// ---------------------------------------------------------------------------
// Brand Engine – KV caching for resolved brand config (v2: per-app + per-kit)
// Per-kit caching: Each kit cached separately for surgical invalidation
// Meta cache: Route mappings + layouts cached per-app
// ---------------------------------------------------------------------------

import type { KVNamespace } from '@cloudflare/workers-types';
import { appKey, globalKey } from '@ottabase/cf/cache-keys';
import type { BrandResolutionCache } from './types';

const CACHE_TTL = 60 * 60; // 1 hour

export interface BrandCacheClient {
    /** Get full resolution data (legacy - for backward compatibility) */
    getResolutionData(appId: string | null, mode?: string): Promise<BrandResolutionCache | null>;
    /** Get single brand kit data */
    getKit(kitId: string): Promise<BrandResolutionCache['brandKitsMap'][string] | null>;
    /** Get route mappings + layouts (meta data) */
    getMeta(appId: string | null): Promise<Omit<BrandResolutionCache, 'brandKitsMap'> | null>;
    /** Set full resolution data (legacy - stores both per-kit and meta) */
    setResolutionData(appId: string | null, mode: string, data: BrandResolutionCache): Promise<void>;
    /** Set single brand kit data */
    setKit(kitId: string, data: BrandResolutionCache['brandKitsMap'][string]): Promise<void>;
    /** Set route mappings + layouts (meta data) */
    setMeta(appId: string | null, data: Omit<BrandResolutionCache, 'brandKitsMap'>): Promise<void>;
    /** Invalidate by kit ID (surgical) or app (full). Kit target: appId = kit's app, requestAppId = requesting app (will refetch). */
    invalidate(
        target: { kitId: string; appId?: string | null; requestAppId?: string | null } | { appId: string | null },
    ): Promise<void>;
}

/**
 * Build cache key for brand resolution data.
 * Uses globalKey for sanitization (colons/whitespace → dash) and consistency with @ottabase/cf/cache-keys.
 * Per-kit: brand:kit:{sanitizedKitId}:resolved
 * Per-app meta: brand:app:{appId}:meta
 * Legacy per-app: brand:app:{appId}:resolved:{mode}
 */
function getKitKey(kitId: string): string {
    return globalKey('brand', 'kit', kitId, 'resolved');
}

function getMetaKey(appId?: string | null): string {
    const effectiveAppId = appId || 'default';
    return appKey('brand', effectiveAppId, 'meta');
}

function getLegacyKey(appId?: string | null, mode?: string): string {
    const effectiveAppId = appId || 'default';
    const effectiveMode = mode || 'light';
    return appKey('brand', effectiveAppId, 'resolved', effectiveMode);
}

export function createBrandCache(kv: KVNamespace): BrandCacheClient {
    return {
        async getResolutionData(appId, mode) {
            // Try new per-kit cache first
            const meta = await this.getMeta(appId);
            if (!meta) {
                // Fallback to legacy cache
                const key = getLegacyKey(appId, mode);
                const cached = await kv.get(key, { type: 'json' });
                return cached as BrandResolutionCache | null;
            }

            // Fetch all kits from route mappings
            const kitIds = [...new Set(meta.routeMappings.map((m) => m.brandKitId))];
            const kits = await Promise.all(kitIds.map((id) => this.getKit(id)));
            const brandKitsMap: BrandResolutionCache['brandKitsMap'] = {};
            kitIds.forEach((id, i) => {
                if (kits[i]) brandKitsMap[id] = kits[i]!;
            });

            // Partial cache = miss: any missing kit means we must load from DB
            const missingCount = kitIds.length - Object.keys(brandKitsMap).length;
            if (missingCount > 0 || Object.keys(brandKitsMap).length === 0) return null;

            return {
                ...meta,
                brandKitsMap,
            };
        },

        async getKit(kitId) {
            const key = getKitKey(kitId);
            const cached = await kv.get(key, { type: 'json' });
            return cached as BrandResolutionCache['brandKitsMap'][string] | null;
        },

        async getMeta(appId) {
            const key = getMetaKey(appId);
            const cached = await kv.get(key, { type: 'json' });
            return cached as Omit<BrandResolutionCache, 'brandKitsMap'> | null;
        },

        async setResolutionData(appId, mode, data) {
            // Store per-kit + meta (new format)
            await this.setMeta(appId, {
                routeMappings: data.routeMappings,
                layoutTemplatesMap: data.layoutTemplatesMap,
            });

            const kitIds = Object.keys(data.brandKitsMap);
            await Promise.all(kitIds.map((id) => this.setKit(id, data.brandKitsMap[id])));

            // Also store legacy format for backward compatibility
            const legacyKey = getLegacyKey(appId, mode);
            await kv.put(legacyKey, JSON.stringify(data), { expirationTtl: CACHE_TTL });
        },

        async setKit(kitId, data) {
            const key = getKitKey(kitId);
            await kv.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
        },

        async setMeta(appId, data) {
            const key = getMetaKey(appId);
            await kv.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
        },

        async invalidate(target) {
            if ('kitId' in target) {
                await kv.delete(getKitKey(target.kitId));
                // Invalidate legacy keys for the kit's app
                const appId = target.appId ?? null;
                for (const m of ['all', 'light', 'dark'] as const) {
                    await kv.delete(getLegacyKey(appId, m));
                }
                // Critical: also invalidate the REQUESTING app's cache (client refetches with its appId)
                const reqAppId = target.requestAppId ?? null;
                if (reqAppId !== null) {
                    await kv.delete(getMetaKey(reqAppId));
                    for (const m of ['all', 'light', 'dark'] as const) {
                        await kv.delete(getLegacyKey(reqAppId, m));
                    }
                }
            } else {
                // Full app invalidation - meta + legacy caches
                await kv.delete(getMetaKey(target.appId));
                for (const m of ['all', 'light', 'dark'] as const) {
                    await kv.delete(getLegacyKey(target.appId, m));
                    // Also invalidate system default when app cache is cleared
                    if (target.appId) await kv.delete(getLegacyKey(null, m));
                }
            }
        },
    };
}
