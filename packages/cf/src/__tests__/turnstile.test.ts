import { describe, expect, it, vi } from 'vitest';

import { requireHuman, TURNSTILE_HEADER, TURNSTILE_TEST_KEYS, verifyTurnstile } from '../turnstile';

const SECRET = 'real-secret';

function answer(body: object, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

function request(token?: string, url = 'https://app.example.com/api/auth/register') {
    const headers = new Headers({ 'CF-Connecting-IP': '203.0.113.9' });
    if (token) headers.set(TURNSTILE_HEADER, token);
    return new Request(url, { method: 'POST', headers });
}

describe('verifyTurnstile', () => {
    it('passes a token minted for this action on this hostname, and sends secret, token and ip', async () => {
        const fetch = answer({ success: true, action: 'signin', hostname: 'app.example.com' });
        const verdict = await verifyTurnstile({
            secret: SECRET,
            token: 'tok',
            action: 'signin',
            hostname: 'app.example.com',
            remoteip: '203.0.113.9',
            fetch,
        });
        expect(verdict).toEqual({ ok: true });
        const body = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]
            .body as URLSearchParams;
        expect(body.get('secret')).toBe(SECRET);
        expect(body.get('response')).toBe('tok');
        expect(body.get('remoteip')).toBe('203.0.113.9');
    });

    it('refuses a token minted for another form or another site', async () => {
        const fetch = answer({ success: true, action: 'subscribe', hostname: 'app.example.com' });
        expect(await verifyTurnstile({ secret: SECRET, token: 't', action: 'signin', fetch })).toMatchObject({
            ok: false,
            reason: 'action',
        });
        const elsewhere = answer({ success: true, action: 'signin', hostname: 'evil.example' });
        expect(
            await verifyTurnstile({
                secret: SECRET,
                token: 't',
                action: 'signin',
                hostname: 'app.example.com',
                fetch: elsewhere,
            }),
        ).toMatchObject({ ok: false, reason: 'hostname' });
    });

    it('tells a used token from a bad one, and both from Cloudflare being down', async () => {
        const spent = answer({ success: false, 'error-codes': ['timeout-or-duplicate'] });
        expect(await verifyTurnstile({ secret: SECRET, token: 't', action: 'a', fetch: spent })).toMatchObject({
            reason: 'spent',
        });
        const bad = answer({ success: false, 'error-codes': ['invalid-input-response'] });
        expect(await verifyTurnstile({ secret: SECRET, token: 't', action: 'a', fetch: bad })).toMatchObject({
            reason: 'invalid',
        });
        const internal = answer({ success: false, 'error-codes': ['internal-error'] });
        expect(await verifyTurnstile({ secret: SECRET, token: 't', action: 'a', fetch: internal })).toMatchObject({
            reason: 'unavailable',
        });
        const http = answer({}, 502);
        expect(await verifyTurnstile({ secret: SECRET, token: 't', action: 'a', fetch: http })).toMatchObject({
            reason: 'unavailable',
        });
        const down = vi.fn(async () => {
            throw new Error('timeout');
        }) as unknown as typeof fetch;
        expect(await verifyTurnstile({ secret: SECRET, token: 't', action: 'a', fetch: down })).toMatchObject({
            reason: 'unavailable',
        });
    });

    it('refuses a missing or oversized token without calling Cloudflare', async () => {
        const fetch = answer({ success: true });
        expect(await verifyTurnstile({ secret: SECRET, token: '  ', action: 'a', fetch })).toMatchObject({
            reason: 'missing',
        });
        expect(await verifyTurnstile({ secret: SECRET, token: 'x'.repeat(2049), action: 'a', fetch })).toMatchObject({
            reason: 'invalid',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not compare action or hostname for a test secret, whose answers are samples', async () => {
        const fetch = answer({ success: true, action: 'test', hostname: 'localhost' });
        expect(
            await verifyTurnstile({
                secret: TURNSTILE_TEST_KEYS.secret.pass,
                token: TURNSTILE_TEST_KEYS.token,
                action: 'signin',
                hostname: 'app.example.com',
                fetch,
            }),
        ).toEqual({ ok: true });
    });
});

describe('requireHuman', () => {
    it('passes everything when no secret is set', async () => {
        const fetch = answer({ success: false });
        expect(
            await requireHuman(request(), { secret: undefined, action: 'register', unreachable: 'refuse', fetch }),
        ).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('answers 403 TURNSTILE_FAILED without a token, and checks against the request hostname', async () => {
        const denied = await requireHuman(request(), {
            secret: SECRET,
            action: 'register',
            unreachable: 'refuse',
            fetch: answer({}),
        });
        expect(denied?.status).toBe(403);
        expect(await denied?.json()).toMatchObject({ code: 'TURNSTILE_FAILED' });

        const fetch = answer({ success: true, action: 'register', hostname: 'app.example.com' });
        expect(
            await requireHuman(request('tok'), { secret: SECRET, action: 'register', unreachable: 'refuse', fetch }),
        ).toBeNull();
    });

    it('refuses with 503 or lets through, logged, when Cloudflare is unreachable', async () => {
        const down = answer({}, 500);
        const refused = await requireHuman(request('tok'), {
            secret: SECRET,
            action: 'reset',
            unreachable: 'refuse',
            fetch: down,
        });
        expect(refused?.status).toBe(503);
        expect(await refused?.json()).toMatchObject({ code: 'TURNSTILE_UNAVAILABLE' });

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(
            await requireHuman(request('tok'), { secret: SECRET, action: 'signin', unreachable: 'allow', fetch: down }),
        ).toBeNull();
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});
