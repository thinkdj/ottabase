/**
 * Tests for KV Cache helper (withCache / invalidateCache)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, invalidateCacheByPrefix, withCache } from '../kv-cache';

// Minimal KVNamespace mock
function createMockKV() {
    const store = new Map<string, { value: string; expiration?: number }>();

    return {
        store,
        get: vi.fn(async (key: string, _type?: string) => {
            const entry = store.get(key);
            return entry ? entry.value : null;
        }),
        put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
            store.set(key, { value, expiration: opts?.expirationTtl });
        }),
        delete: vi.fn(async (key: string) => {
            store.delete(key);
        }),
        list: vi.fn(async (opts?: { prefix?: string; cursor?: string }) => {
            const prefix = opts?.prefix ?? '';
            const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
            return { keys, list_complete: true, cursor: '' };
        }),
    } as unknown as KVNamespace & {
        store: Map<string, { value: string; expiration?: number }>;
        get: ReturnType<typeof vi.fn>;
        put: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        list: ReturnType<typeof vi.fn>;
    };
}

type MockKV = ReturnType<typeof createMockKV>;

describe('withCache', () => {
    let kv: MockKV;

    beforeEach(() => {
        kv = createMockKV();
    });

    it('should call fetcher on cache miss and store result', async () => {
        const fetcher = vi.fn(async () => ({ name: 'Alice' }));

        const result = await withCache(kv, 'test:key', 60, fetcher);

        expect(result).toEqual({ name: 'Alice' });
        expect(fetcher).toHaveBeenCalledOnce();
        expect(kv.put).toHaveBeenCalledWith('test:key', JSON.stringify({ name: 'Alice' }), {
            expirationTtl: 60,
        });
    });

    it('should return cached value without calling fetcher', async () => {
        kv.store.set('test:key', { value: JSON.stringify({ name: 'Cached' }) });
        const fetcher = vi.fn(async () => ({ name: 'Fresh' }));

        const result = await withCache(kv, 'test:key', 60, fetcher);

        expect(result).toEqual({ name: 'Cached' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('should propagate fetcher errors by default', async () => {
        const fetcher = vi.fn(async () => {
            throw new Error('DB down');
        });

        await expect(withCache(kv, 'err:key', 60, fetcher)).rejects.toThrow('DB down');
    });

    it('should work with primitive return types', async () => {
        const result = await withCache(kv, 'prim:key', 60, async () => 'hello');
        expect(result).toBe('hello');
    });

    it('should work with array return types', async () => {
        const result = await withCache(kv, 'arr:key', 60, async () => [1, 2, 3]);
        expect(result).toEqual([1, 2, 3]);
    });
});

describe('invalidateCache', () => {
    it('should delete the key from KV', async () => {
        const kv = createMockKV();
        kv.store.set('test:key', { value: '"data"' });

        await invalidateCache(kv, 'test:key');

        expect(kv.delete).toHaveBeenCalledWith('test:key');
        expect(kv.store.has('test:key')).toBe(false);
    });
});

describe('invalidateCacheByPrefix', () => {
    it('should delete all keys matching prefix', async () => {
        const kv = createMockKV();
        kv.store.set('user:1:profile', { value: '"a"' });
        kv.store.set('user:1:roles', { value: '"b"' });
        kv.store.set('user:2:profile', { value: '"c"' });
        kv.store.set('org:acme:config', { value: '"d"' });

        const deleted = await invalidateCacheByPrefix(kv, 'user:1:');

        expect(deleted).toBe(2);
        expect(kv.store.has('user:1:profile')).toBe(false);
        expect(kv.store.has('user:1:roles')).toBe(false);
        // Other keys untouched
        expect(kv.store.has('user:2:profile')).toBe(true);
        expect(kv.store.has('org:acme:config')).toBe(true);
    });

    it('should return 0 when no keys match', async () => {
        const kv = createMockKV();

        const deleted = await invalidateCacheByPrefix(kv, 'nonexistent:');

        expect(deleted).toBe(0);
    });
});
