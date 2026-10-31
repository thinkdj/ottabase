import { afterEach, describe, expect, it, vi } from 'vitest';
import { files, purgeFromCache } from '../files';

describe('purgeFromCache (quarantine)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('asks Cloudflare to purge the URLs on the files zone, and reports whether it did', async () => {
        const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetch);
        const env = {
            CLOUDFLARE_FILES_ZONE_ID: 'zone-1',
            CLOUDFLARE_PURGE_API_TOKEN: 'tok',
        } as unknown as CloudflareEnv;
        expect(await purgeFromCache(env, ['https://files.test/a/media/x.png'])).toBe(true);
        expect(fetch).toHaveBeenCalledWith('https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache', {
            method: 'POST',
            headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: ['https://files.test/a/media/x.png'] }),
        });
        fetch.mockResolvedValueOnce(new Response('{}', { status: 403 }));
        expect(await purgeFromCache(env, ['https://files.test/a'])).toBe(false);
    });

    it('is not configured without the zone and the token: the admin purges by hand', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        expect(await purgeFromCache({} as CloudflareEnv, ['https://files.test/a'])).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('files.publicBase (the app composition)', () => {
    it('is absolute against AUTH_URL, so logos and images work in mail and social cards', () => {
        expect(files.publicBase({ AUTH_URL: 'https://app.example.com/' } as unknown as CloudflareEnv)).toBe(
            'https://app.example.com/api/files/public',
        );
        expect(
            files.publicBase({
                AUTH_URL: 'https://app.example.com',
                R2_PUBLIC_URL: 'https://files.example-usercontent.com',
            } as unknown as CloudflareEnv),
        ).toBe('https://files.example-usercontent.com');
    });
});
