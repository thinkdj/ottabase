import { Shortlink } from '@ottabase/shortlinks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleShortlinkHost, handleShortlinkRedirect } from '../shortlinks';

vi.mock('../../lib/db-utils', () => ({ ensureDbConnection: vi.fn() }));

const ctx = (url: string, env: Record<string, unknown> = {}, init: RequestInit = {}) => {
    const request = new Request(url, init);
    return { request, url: new URL(url), env: { OBCF_D1: {}, ...env } as unknown as CloudflareEnv };
};

/** A stored link, as far as the redirect cares. */
const link = (fullUrl: string) =>
    ({
        isExpired: () => false,
        get: (key: string) => ({ shortCode: 'gh', fullUrl })[key],
    }) as unknown as Shortlink;

const findByCode = vi.spyOn(Shortlink, 'findByCode');

afterEach(() => {
    findByCode.mockReset();
});

describe('handleShortlinkRedirect (/s/<code>)', () => {
    it('redirects a known code, with or without a trailing slash', async () => {
        findByCode.mockResolvedValue(link('https://github.com/ottabase'));

        for (const path of ['gh', 'gh/']) {
            const response = await handleShortlinkRedirect(ctx(`https://app.test/s/${path}`), path);
            expect(response.status).toBe(302);
            expect(response.headers.get('Location')).toBe('https://github.com/ottabase');
        }
        expect(findByCode.mock.calls).toEqual([['gh'], ['gh']]);
    });

    it('never asks the database about a path that cannot be a code', async () => {
        for (const path of ['', 'a', 'a/b', 'favicon.ico', 'robots.txt', '%41bc', 'x'.repeat(51)]) {
            const response = await handleShortlinkRedirect(ctx(`https://app.test/s/${path}`), path);
            expect(response.status, path).toBe(404);
        }
        expect(findByCode).not.toHaveBeenCalled();
    });

    it('answers an unknown code with a page for a browser and JSON for anything else', async () => {
        findByCode.mockResolvedValue(null);

        const page = await handleShortlinkRedirect(
            ctx('https://app.test/s/nope', {}, { headers: { Accept: 'text/html,*/*' } }),
            'nope',
        );
        expect(page.status).toBe(404);
        expect(page.headers.get('Content-Type')).toContain('text/html');
        expect(await page.text()).toContain('Link not found');

        const json = await handleShortlinkRedirect(ctx('https://app.test/s/nope'), 'nope');
        expect(json.status).toBe(404);
        expect(await json.json()).toMatchObject({ code: 'LINK_NOT_FOUND' });
    });
});

describe('handleShortlinkHost (SHORTLINKS_HOST)', () => {
    it('is off when unset, and ignores every other host', async () => {
        expect(await handleShortlinkHost(ctx('https://app.test/gh'))).toBeNull();
        expect(await handleShortlinkHost(ctx('https://app.test/gh', { SHORTLINKS_HOST: 'go.test' }))).toBeNull();
        expect(findByCode).not.toHaveBeenCalled();
    });

    it('resolves a bare code on the short host, however the var was typed', async () => {
        findByCode.mockResolvedValue(link('https://example.com/'));

        for (const value of ['go.test', ' Go.Test ', 'https://go.test/', 'go.test:443']) {
            const response = await handleShortlinkHost(ctx('https://go.test/gh', { SHORTLINKS_HOST: value }));
            expect(response?.status, value).toBe(302);
        }
    });

    it('serves nothing but redirects there', async () => {
        const env = { SHORTLINKS_HOST: 'go.test' };
        expect((await handleShortlinkHost(ctx('https://go.test/', env)))?.status).toBe(404);
        expect((await handleShortlinkHost(ctx('https://go.test/api/auth/session', env)))?.status).toBe(404);
        expect((await handleShortlinkHost(ctx('https://go.test/gh', env, { method: 'POST' })))?.status).toBe(405);
        expect(findByCode).not.toHaveBeenCalled();
    });

    it("ignores a value that names the app's own domain, which would 404 the whole app", async () => {
        const env = { SHORTLINKS_HOST: 'app.test', AUTH_URL: 'https://app.test' };
        expect(await handleShortlinkHost(ctx('https://app.test/dashboard', env))).toBeNull();
    });
});
