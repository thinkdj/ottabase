import { describe, expect, it } from 'vitest';
import { Shortlink, buildRedirectResponse } from '../ottaorm-models/Shortlink';

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
        expect(Shortlink.casts.clicks).toBe('number');
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
        expect(body).toContain('Redirecting');
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
