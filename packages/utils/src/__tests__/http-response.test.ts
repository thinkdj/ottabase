import { describe, expect, it } from 'vitest';
import { jsonResponse } from '../http-response';

describe('jsonResponse', () => {
    it('preserves Headers instances while enforcing the JSON content type', async () => {
        const response = jsonResponse({ ok: true }, 201, {
            headers: new Headers({ 'Cache-Control': 'no-store', 'X-Request-Id': 'request-1' }),
        });

        expect(response.status).toBe(201);
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('x-request-id')).toBe('request-1');
        await expect(response.json()).resolves.toEqual({ ok: true });
    });

    it('preserves tuple-array headers', () => {
        const response = jsonResponse({}, 200, { headers: [['Set-Cookie', 'session=fixture']] });

        expect(response.headers.get('set-cookie')).toBe('session=fixture');
    });
});
