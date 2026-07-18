/**
 * Tests for the KV-backed rate limiter and the secret-gated brute-force throttle helper.
 *
 * Covers the counting logic the reviewer flagged as untested:
 *  - simulateRateLimit increments per request, allows the first LIMIT, then blocks;
 *  - the sliding window resets after PERIOD elapses;
 *  - a missing KV binding yields no counter (null);
 * and the fail-open POLICY that keeps bootstrap/promote consistent:
 *  - enforceBruteForceThrottle blocks (429) only when genuinely over the limit,
 *  - and FAILS OPEN (null) with a logged warning when the limiter binding is unavailable,
 *    so a missing binding can't brick first-run bootstrap or break-glass ownership recovery.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory KV backing the mocked createKVClient, so simulateRateLimit's real counting runs.
const kvStore = new Map<string, string>();

vi.mock('@ottabase/cf/kv', () => ({
    createKVClient: () => ({
        getText: async (key: string) => ({ success: true, data: kvStore.get(key) ?? null }),
        put: async (key: string, value: string) => {
            kvStore.set(key, value);
        },
    }),
}));

import { enforceBruteForceThrottle, simulateRateLimit } from '../rate-limiting';

function makeEnv(overrides: Record<string, unknown> = {}) {
    // OBCF_RATE_LIMITER intentionally left unset so getRateLimitData falls through to simulateRateLimit.
    return { OBCF_KV: {}, ...overrides } as any;
}

function makeRequest() {
    return new Request('http://localhost/api/test');
}

describe('simulateRateLimit (KV counting)', () => {
    beforeEach(() => kvStore.clear());

    it('allows the first LIMIT (10) requests then blocks further ones in the same window', async () => {
        const env = makeEnv();
        for (let i = 1; i <= 10; i++) {
            const r = await simulateRateLimit(env, 'k');
            expect(r?.success, `request ${i} should be allowed`).toBe(true);
        }
        const eleventh = await simulateRateLimit(env, 'k');
        expect(eleventh?.success).toBe(false);
        expect(eleventh?.remaining).toBe(0);
    });

    it('decrements the remaining budget as requests are counted', async () => {
        const env = makeEnv();
        expect((await simulateRateLimit(env, 'k'))?.remaining).toBe(9);
        expect((await simulateRateLimit(env, 'k'))?.remaining).toBe(8);
    });

    it('keys are independent — spending one key does not throttle another', async () => {
        const env = makeEnv();
        for (let i = 0; i < 11; i++) await simulateRateLimit(env, 'ip-a');
        // ip-a is now over the limit; ip-b starts fresh.
        expect((await simulateRateLimit(env, 'ip-a'))?.success).toBe(false);
        expect((await simulateRateLimit(env, 'ip-b'))?.success).toBe(true);
    });

    it('resets the window after the PERIOD (60s) elapses', async () => {
        vi.useFakeTimers();
        try {
            const env = makeEnv();
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
            for (let i = 0; i < 10; i++) await simulateRateLimit(env, 'k');
            expect((await simulateRateLimit(env, 'k'))?.success).toBe(false); // 11th blocked

            // Advance beyond the 60s window → counter resets and requests are allowed again.
            vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
            const afterReset = await simulateRateLimit(env, 'k');
            expect(afterReset?.success).toBe(true);
            expect(afterReset?.remaining).toBe(9);
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns null (no counting possible) when there is no KV binding', async () => {
        expect(await simulateRateLimit(makeEnv({ OBCF_KV: undefined }), 'k')).toBeNull();
    });
});

describe('enforceBruteForceThrottle (secret-gated, fail-open policy)', () => {
    beforeEach(() => kvStore.clear());

    it('returns null while under the limit (request proceeds to the secret gate)', async () => {
        expect(await enforceBruteForceThrottle(makeRequest(), makeEnv(), 'k', 'test')).toBeNull();
    });

    it('returns a 429 once over the limit', async () => {
        const env = makeEnv();
        for (let i = 0; i < 10; i++) await enforceBruteForceThrottle(makeRequest(), env, 'k', 'test');
        const res = await enforceBruteForceThrottle(makeRequest(), env, 'k', 'test');
        expect(res?.status).toBe(429);
    });

    it('FAILS OPEN (null) with a logged warning when the limiter binding is unavailable', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // No OBCF_KV and no OBCF_RATE_LIMITER → enforceRateLimit would 500; the helper must not block.
        const res = await enforceBruteForceThrottle(makeRequest(), makeEnv({ OBCF_KV: undefined }), 'k', 'promote');
        expect(res).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
