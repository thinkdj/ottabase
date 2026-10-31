import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/rate-limiting', () => ({ enforceRateLimit: vi.fn() }));

import { TURNSTILE_HEADER, TURNSTILE_SITEVERIFY_URL, TURNSTILE_TEST_KEYS } from '@ottabase/cf/turnstile';
import { enforceRateLimit } from '../../lib/rate-limiting';
import { handleTurnstileDemo } from '../cloudflare-turnstile';
import type { ApiRouteContext } from '../router';

function ctx(body: unknown, env: Partial<CloudflareEnv> = {}, token = 'tok') {
    const request = new Request('https://app.example.com/api/cloudflare/turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [TURNSTILE_HEADER]: token },
        body: JSON.stringify(body),
    });
    return { request, env } as unknown as ApiRouteContext;
}

beforeEach(() => {
    // A spy on fetch survives restoreAllMocks here, so its calls are cleared too.
    vi.clearAllMocks();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe('handleTurnstileDemo', () => {
    it('checks a test key with its paired test secret and answers the verdict', async () => {
        const fetch = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] })),
            );
        const res = await handleTurnstileDemo(ctx({ mode: 'block' }));
        expect(await res.json()).toEqual({
            data: { mode: 'block', ok: false, reason: 'invalid', codes: ['invalid-input-response'] },
        });
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
        expect((init.body as URLSearchParams).get('secret')).toBe(TURNSTILE_TEST_KEYS.secret.fail);
    });

    it("uses the app's secret only when the app has both keys", async () => {
        const off = await handleTurnstileDemo(ctx({ mode: 'app' }));
        expect(off.status).toBe(400);

        const fetch = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(JSON.stringify({ success: true, action: 'demo', hostname: 'app.example.com' })),
            );
        const env = { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'app-secret' };
        const res = await handleTurnstileDemo(ctx({ mode: 'app' }, env));
        expect(await res.json()).toEqual({ data: { mode: 'app', ok: true } });
        expect(((fetch.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams).get('secret')).toBe(
            'app-secret',
        );
    });

    it('is rate limited per IP and refuses an unknown mode', async () => {
        vi.mocked(enforceRateLimit).mockResolvedValueOnce(new Response(null, { status: 429 }));
        expect((await handleTurnstileDemo(ctx({ mode: 'pass' }))).status).toBe(429);
        expect((await handleTurnstileDemo(ctx({ mode: 'nope' }))).status).toBe(400);
    });
});
