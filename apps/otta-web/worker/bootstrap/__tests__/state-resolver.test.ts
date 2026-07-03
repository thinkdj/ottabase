/**
 * Tests for the platform state resolver — especially the READY fast path
 * (isolate memo + KV early return) and its invalidation on state transitions.
 *
 * The memo is module-scope state, so every test resets it via
 * invalidatePlatformStateCache() in beforeEach.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePlatformStateCache, resolvePlatformState, writeDBState, writeKVState } from '../state-resolver';
import { KV_PLATFORM_STATE_KEY } from '../types';

type MockedEnv = {
    env: any;
    kvStore: Map<string, string>;
    kvGet: ReturnType<typeof vi.fn>;
    kvPut: ReturnType<typeof vi.fn>;
    d1Prepare: ReturnType<typeof vi.fn>;
    setDbState: (state: string | null) => void;
};

/** Build a mock CloudflareEnv with controllable KV + D1 platform state. */
function makeEnv(overrides: Record<string, unknown> = {}): MockedEnv {
    const kvStore = new Map<string, string>();
    let dbState: string | null = null;

    const kvGet = vi.fn(async (key: string) => kvStore.get(key) ?? null);
    const kvPut = vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
    });

    // D1 statement chain: prepare(...).bind(...).all() / .run()
    const all = vi.fn(async () => ({
        results: dbState === null ? [] : [{ value: dbState }],
    }));
    const run = vi.fn(async () => ({}));
    const stmt: any = { all, run };
    stmt.bind = vi.fn(() => stmt);
    const d1Prepare = vi.fn(() => stmt);

    const env = {
        ENVIRONMENT: 'production',
        OBCF_KV: { get: kvGet, put: kvPut },
        OBCF_D1: { prepare: d1Prepare },
        OBCF_R2: {},
        OBCF_QUEUE: {},
        OBCF_ASSETS: {},
        ...overrides,
    };

    return {
        env,
        kvStore,
        kvGet,
        kvPut,
        d1Prepare,
        setDbState: (state) => {
            dbState = state;
        },
    };
}

beforeEach(() => {
    invalidatePlatformStateCache();
});

describe('resolvePlatformState — precedence', () => {
    it('skips all I/O in test environments', async () => {
        const { env, kvGet, d1Prepare } = makeEnv({ ENVIRONMENT: 'test' });
        const result = await resolvePlatformState(env);
        expect(result.state).toBe('READY');
        expect(result.source).toBe('env');
        expect(kvGet).not.toHaveBeenCalled();
        expect(d1Prepare).not.toHaveBeenCalled();
    });

    it('ENV lock overrides an armed READY memo', async () => {
        const first = makeEnv();
        first.kvStore.set(KV_PLATFORM_STATE_KEY, 'READY');
        await resolvePlatformState(first.env); // arms the memo via KV fast path

        const locked = makeEnv({ OTTABASE_LOCKED: 'true' });
        const result = await resolvePlatformState(locked.env);
        expect(result.state).toBe('BOOTSTRAPPING');
        expect(result.source).toBe('env');
    });

    it('reports UNINITIALIZED when the D1 binding is missing', async () => {
        const { env } = makeEnv({ OBCF_D1: undefined });
        const result = await resolvePlatformState(env);
        expect(result.state).toBe('UNINITIALIZED');
        expect(result.source).toBe('probe');
    });
});

describe('resolvePlatformState — READY fast path', () => {
    it('KV=READY returns without probing D1 and arms the memo', async () => {
        const { env, kvGet, d1Prepare, kvStore } = makeEnv();
        kvStore.set(KV_PLATFORM_STATE_KEY, 'READY');

        const first = await resolvePlatformState(env);
        expect(first.state).toBe('READY');
        expect(first.source).toBe('kv');
        expect(d1Prepare).not.toHaveBeenCalled();

        // Second resolve within TTL: memo — zero additional I/O.
        const second = await resolvePlatformState(env);
        expect(second.source).toBe('memo');
        expect(kvGet).toHaveBeenCalledTimes(1);
        expect(d1Prepare).not.toHaveBeenCalled();
    });

    it('DB=READY on the slow path repopulates KV and arms the memo', async () => {
        const { env, kvPut, setDbState } = makeEnv();
        setDbState('READY'); // KV empty → slow path probes D1

        const first = await resolvePlatformState(env);
        expect(first.state).toBe('READY');
        expect(first.source).toBe('db');
        expect(kvPut).toHaveBeenCalledWith(KV_PLATFORM_STATE_KEY, 'READY');

        const second = await resolvePlatformState(env);
        expect(second.source).toBe('memo');
    });

    it('DB=BOOTSTRAPPING resolves without arming the memo', async () => {
        const { env, kvGet, setDbState } = makeEnv();
        setDbState('BOOTSTRAPPING');

        const first = await resolvePlatformState(env);
        expect(first.state).toBe('BOOTSTRAPPING');
        expect(first.source).toBe('db');

        // Not READY → no memo; the next resolve does I/O again.
        await resolvePlatformState(env);
        expect(kvGet).toHaveBeenCalledTimes(2);
    });
});

describe('READY memo invalidation on state transitions', () => {
    it('writeKVState(non-READY) drops the memo immediately', async () => {
        const { env, kvStore, setDbState } = makeEnv();
        kvStore.set(KV_PLATFORM_STATE_KEY, 'READY');
        await resolvePlatformState(env); // memo armed
        expect((await resolvePlatformState(env)).source).toBe('memo');

        await writeKVState(env, 'BOOTSTRAPPING');
        setDbState('BOOTSTRAPPING');

        const result = await resolvePlatformState(env);
        expect(result.source).not.toBe('memo');
        expect(result.state).toBe('BOOTSTRAPPING');
    });

    it('writeDBState(non-READY) drops the memo even if the D1 write fails', async () => {
        const { env, kvStore, kvGet } = makeEnv();
        kvStore.set(KV_PLATFORM_STATE_KEY, 'READY');
        await resolvePlatformState(env); // memo armed
        const kvReadsAfterArm = kvGet.mock.calls.length;

        // Invalidation happens before the write — even a missing binding drops the memo.
        await writeDBState({ ...env, OBCF_D1: undefined }, 'UNINITIALIZED');

        const result = await resolvePlatformState(env);
        expect(kvGet.mock.calls.length).toBeGreaterThan(kvReadsAfterArm); // real re-resolve, no memo
        expect(result.source).toBe('kv'); // KV still says READY in this scenario
    });

    it('writeKVState(READY) keeps the memo armed', async () => {
        const { env, kvStore, kvGet } = makeEnv();
        kvStore.set(KV_PLATFORM_STATE_KEY, 'READY');
        await resolvePlatformState(env); // memo armed

        await writeKVState(env, 'READY');

        const result = await resolvePlatformState(env);
        expect(result.source).toBe('memo');
        expect(kvGet).toHaveBeenCalledTimes(1);
    });
});
