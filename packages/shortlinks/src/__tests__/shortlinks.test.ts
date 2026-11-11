import { describe, expect, it } from 'vitest';
import { Shortlink, buildRedirectResponse } from '../ottaorm-models/Shortlink';
import { SHORT_CODE } from '../types';

const createShortlinkStub = (fields: Record<string, unknown> = {}) =>
    ({
        isExpired: () => Boolean(fields.expired),
        get: (key: string) => {
            return key in fields ? fields[key] : undefined;
        },
    }) as unknown as Shortlink;

describe('Shortlink model helpers', () => {
    it('casts interstitial metadata as expected', () => {
        expect(Shortlink.casts.interstitialEnabled).toBe('boolean');
        expect(Shortlink.casts.interstitialSeconds).toBe('number');
    });

    it('returns the expired page when the shortlink is expired', () => {
        const shortlink = createShortlinkStub({
            expired: true,
            fullUrl: 'https://example.com',
        });

        const response = buildRedirectResponse(shortlink);
        expect(response.status).toBe(410);
        expect(response.headers.get('Content-Type')).toContain('text/html');
    });

    it('returns the interstitial page when enabled', async () => {
        const shortlink = createShortlinkStub({
            fullUrl: 'https://example.com',
            interstitialEnabled: true,
            interstitialSeconds: 5,
        });

        const response = buildRedirectResponse(shortlink);
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).toContain('Opening your link');
        expect(body).toContain('Open now');
        expect(body).toContain('5');
    });

    it('redirects to the target URL when not expired or interstitial', () => {
        const shortlink = createShortlinkStub({
            fullUrl: 'https://example.com',
        });

        const response = buildRedirectResponse(shortlink);
        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(new URL('https://example.com').toString());
    });
});

describe('short code rule', () => {
    it('accepts 2 to 50 letters, numbers, dashes and underscores', () => {
        for (const code of ['gh', 'my-link', 'Launch_2026', 'x'.repeat(50)])
            expect(SHORT_CODE.test(code), code).toBe(true);
    });

    it('refuses anything a URL path would mangle or a route would shadow', () => {
        for (const code of ['', 'a', 'a/b', 'a b', 'a.b', 'a?b', 'a%20b', 'é', 'x'.repeat(51)]) {
            expect(SHORT_CODE.test(code), code).toBe(false);
        }
    });

    it('is enforced on create and on update, before the database is touched', async () => {
        await expect(
            Shortlink.create({ fullUrl: 'https://example.com', shortCode: 'api/health' }),
        ).rejects.toMatchObject({
            code: 'INVALID_SHORT_CODE',
        });
        const prepare = (Shortlink as any).prepareUpdateMutation.bind(Shortlink);
        await expect(prepare({ shortCode: 'a.b' })).rejects.toMatchObject({ code: 'INVALID_SHORT_CODE' });
        await expect(prepare({ shortCode: ' ok-code ' })).resolves.toEqual({ shortCode: 'ok-code' });
        await expect(prepare({ type: 'redirect' })).resolves.toEqual({ type: 'redirect' });
    });
});
