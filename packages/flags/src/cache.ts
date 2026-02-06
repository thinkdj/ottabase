// ============================================================
// KV Cache Layer for Feature Flags
// ============================================================

import type { KVNamespace } from '@cloudflare/workers-types';
import type { ResolvedFlag } from './engine';

const CACHE_KEY = 'feature_flags:all';
const DEFAULT_TTL_SECONDS = 60; // 1 minute cache

/**
 * KV-backed cache for feature flags.
 * Stores all flags in a single KV key for fast edge reads.
 *
 * Usage:
 *   const flags = await getCachedFlags(env.OBCF_KV, fetchFromDb);
 */
export async function getCachedFlags(
    kv: KVNamespace | undefined,
    fetchFromDb: () => Promise<ResolvedFlag[]>,
    ttl: number = DEFAULT_TTL_SECONDS,
): Promise<ResolvedFlag[]> {
    if (!kv) {
        return fetchFromDb();
    }

    const cached = await kv.get(CACHE_KEY, 'json');
    if (cached) {
        return cached as ResolvedFlag[];
    }

    const flags = await fetchFromDb();
    await kv.put(CACHE_KEY, JSON.stringify(flags), { expirationTtl: ttl });
    return flags;
}

/**
 * Invalidate the flag cache. Call this after any flag CRUD operation.
 */
export async function invalidateFlagCache(kv: KVNamespace | undefined): Promise<void> {
    if (!kv) return;
    await kv.delete(CACHE_KEY);
}
