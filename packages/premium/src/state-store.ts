// ============================================================
// @ottabase/premium — install-record persistence
// ============================================================
// Two adapters, one interface. KV is the deployment default; the in-memory adapter is
// what makes a KV-less boot (tests, `wrangler dev` without a namespace, a CI type
// check) behave IDENTICALLY rather than throwing on the first status read.
//
// What lives here is bookkeeping — installed version, activation timestamps, an
// operator-pasted license. None of it is an authorization input: the license is
// re-verified cryptographically on every resolve, so a tampered KV value buys nothing.
// ============================================================

import type { PremiumInstallRecord, PremiumStateStore } from './types';

/** Minimal structural type for a Cloudflare KV namespace. Avoids a workers-types dependency. */
export interface KVNamespaceLike {
    get(key: string, type?: 'text'): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}

export const DEFAULT_STATE_PREFIX = 'ottabase:premium:';

function parseRecord(raw: string | null): PremiumInstallRecord | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PremiumInstallRecord;
        return parsed && typeof parsed.version === 'string' ? parsed : null;
    } catch {
        // A corrupt value reads as "not installed" rather than throwing. The install
        // lifecycle is idempotent, so the next resolve simply re-installs over it.
        return null;
    }
}

/**
 * KV-backed store.
 *
 * EVERY WRITE IS BEST-EFFORT. A failed write must not fail the request that triggered
 * it: the worst outcome is that `onInstall` runs twice, which the hook contract already
 * requires to be safe. A failed READ is likewise "not installed", never an error page.
 */
export function createKvStateStore(kv: KVNamespaceLike, prefix = DEFAULT_STATE_PREFIX): PremiumStateStore {
    return {
        async get(key) {
            try {
                return parseRecord(await kv.get(`${prefix}${key}`));
            } catch {
                return null;
            }
        },
        async set(key, record) {
            try {
                await kv.put(`${prefix}${key}`, JSON.stringify(record));
            } catch {
                /* best-effort: bookkeeping must never break a request */
            }
        },
        async delete(key) {
            try {
                await kv.delete(`${prefix}${key}`);
            } catch {
                /* best-effort */
            }
        },
        async list() {
            try {
                const result = await kv.list({ prefix });
                return result.keys.map((entry) => entry.name.slice(prefix.length)).filter(Boolean);
            } catch {
                return [];
            }
        },
    };
}

/** In-memory store. Used by tests and as the fallback when no KV binding exists. */
export function createMemoryStateStore(seed?: Record<string, PremiumInstallRecord>): PremiumStateStore {
    const map = new Map<string, PremiumInstallRecord>(Object.entries(seed ?? {}));
    return {
        async get(key) {
            return map.get(key) ?? null;
        },
        async set(key, record) {
            map.set(key, record);
        },
        async delete(key) {
            map.delete(key);
        },
        async list() {
            return [...map.keys()];
        },
    };
}
