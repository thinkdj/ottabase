// The isolate READY memo saves every normal request a KV read. A /__bootstrap__ request used to
// drop it unconditionally, so anyone looping on that path made real traffic pay the read again.
// Only a request that holds the bootstrap secret may drop it now.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import workerHandler from '../../../cloudflare-worker';
import { invalidatePlatformStateCache, KV_PLATFORM_STATE_KEY } from '..';

const SECRET = 'fixture-secret';

describe('READY memo vs /__bootstrap__ requests', () => {
    let env: any;

    const fetch = (path: string, headers: Record<string, string> = {}) =>
        workerHandler.fetch!(new Request(`https://app.test${path}`, { headers }) as any, env, {
            waitUntil: vi.fn(),
            passThroughOnException: vi.fn(),
        } as unknown as ExecutionContext);

    /** How many times the platform state was read from KV. */
    const stateReads = () =>
        env.OBCF_KV.get.mock.calls.filter(([key]: [string]) => key === KV_PLATFORM_STATE_KEY).length;

    beforeEach(() => {
        vi.clearAllMocks();
        invalidatePlatformStateCache();
        env = {
            OBCF_D1: (global as any).OBCF_D1,
            OBCF_KV: (global as any).OBCF_KV,
            OBCF_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
            ENVIRONMENT: 'production',
            BOOTSTRAP_OWNER_SECRET: SECRET,
        };
        env.OBCF_KV.get.mockImplementation(async (key: string) => (key === KV_PLATFORM_STATE_KEY ? 'READY' : null));
        env.OBCF_D1.prepare.mockImplementation(() => ({
            bind: vi.fn().mockReturnThis(),
            raw: vi.fn().mockResolvedValue([]),
            all: vi.fn().mockResolvedValue({ results: [], success: true }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } }),
        }));
    });

    it('an anonymous request gets its 401 and leaves the memo armed', async () => {
        await fetch('/api/health');
        expect(stateReads()).toBe(1);

        for (const path of ['/__bootstrap__', '/__bootstrap__/api/status', '/__bootstrap__/anything']) {
            expect((await fetch(path)).status, path).toBe(401);
        }
        await fetch('/api/health');

        expect(stateReads()).toBe(1);
    });

    it('a request with the secret resolves fresh and drops the memo behind it', async () => {
        await fetch('/api/health');
        expect(stateReads()).toBe(1);

        await fetch('/__bootstrap__/api/status', { 'X-Bootstrap-Secret': SECRET });
        expect(stateReads()).toBe(2);

        await fetch('/api/health');
        expect(stateReads()).toBe(3);
    });
});
