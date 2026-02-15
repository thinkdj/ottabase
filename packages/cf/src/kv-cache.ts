/**
 * Read-through KV cache helper
 *
 * Wraps a fetcher function with KV-backed caching.
 * On cache hit, returns the stored value; on miss, calls the fetcher,
 * stores the result in KV, and returns it.
 *
 * @example
 * const profile = await withCache(env.OBCF_KV, userKey('auth', userId, 'profile'), 300, async () => {
 *     return db.query.users.findFirst({ where: eq(users.id, userId) });
 * });
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Read-through cache: returns cached value if present, otherwise calls
 * `fetcher`, stores result in KV, and returns it.
 *
 * @param kv - Cloudflare KV namespace binding
 * @param key - Cache key (use cache-keys helpers to build)
 * @param ttl - Cache TTL in seconds
 * @param fetcher - Async function that produces the value on cache miss
 * @returns The cached or freshly-fetched value
 */
export async function withCache<T>(kv: KVNamespace, key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    // Try cache first
    const cached = await kv.get(key, 'text');
    if (cached !== null) {
        return JSON.parse(cached) as T;
    }

    // Cache miss — call fetcher, store result
    const value = await fetcher();
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
    return value;
}

/**
 * Invalidate a cached entry.
 * Convenience wrapper — equivalent to `kv.delete(key)`.
 */
export async function invalidateCache(kv: KVNamespace, key: string): Promise<void> {
    await kv.delete(key);
}

/**
 * Invalidate all keys matching a prefix.
 * Lists keys by prefix and deletes them in parallel.
 *
 * Note: KV list is eventually consistent — recently written keys
 * may not appear immediately.
 */
export async function invalidateCacheByPrefix(kv: KVNamespace, prefix: string): Promise<number> {
    let cursor: string | undefined;
    let deleted = 0;

    do {
        const list = await kv.list({ prefix, cursor });
        if (list.keys.length) {
            await Promise.all(list.keys.map((k) => kv.delete(k.name)));
            deleted += list.keys.length;
        }
        cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return deleted;
}
