import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../rate-limiting', () => ({ enforceRateLimit: vi.fn() }));

import { TURNSTILE_HEADER } from '@ottabase/cf/turnstile';
import { enforceRateLimit } from '../rate-limiting';
import {
    guardPublicForm,
    injectTurnstileSiteKey,
    requireHuman,
    turnstileMetaTag,
    turnstileSiteKey,
} from '../turnstile';

const KEYS = { TURNSTILE_SITE_KEY: '0x4AAAAAAA-site_key', TURNSTILE_SECRET_KEY: 'secret' };

function form(token?: string) {
    const headers = new Headers();
    if (token) headers.set(TURNSTILE_HEADER, token);
    return new Request('https://app.example.com/api/auth/register', { method: 'POST', headers });
}

function siteverify(body: object) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
}

beforeEach(() => {
    // A spy on fetch survives restoreAllMocks here, so its calls are cleared too.
    vi.clearAllMocks();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe('turnstile keys', () => {
    it('is on only when both keys are set, so a secret alone never refuses every form', () => {
        expect(turnstileSiteKey(KEYS)).toBe(KEYS.TURNSTILE_SITE_KEY);
        expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: KEYS.TURNSTILE_SITE_KEY })).toBeNull();
        expect(turnstileSiteKey({ TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_SITE_KEY: ' ' })).toBeNull();
    });

    it('lets everything through when off, without calling Cloudflare', async () => {
        const fetch = siteverify({ success: false });
        expect(
            await requireHuman(
                form(),
                { TURNSTILE_SECRET_KEY: 'secret' },
                { action: 'register', unreachable: 'refuse' },
            ),
        ).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses a missing token and passes a good one when on', async () => {
        const denied = await requireHuman(form(), KEYS, { action: 'register', unreachable: 'refuse' });
        expect(denied?.status).toBe(403);
        siteverify({ success: true, action: 'register', hostname: 'app.example.com' });
        expect(await requireHuman(form('tok'), KEYS, { action: 'register', unreachable: 'refuse' })).toBeNull();
    });
});

describe('guardPublicForm', () => {
    it('answers the rate limit first and never reaches Cloudflare when over it', async () => {
        const fetch = siteverify({ success: true });
        vi.mocked(enforceRateLimit).mockResolvedValue(new Response(null, { status: 429 }));
        const env = KEYS as unknown as CloudflareEnv;
        const res = await guardPublicForm(form('tok'), env, { action: 'register', key: 'k', unreachable: 'refuse' });
        expect(res?.status).toBe(429);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('then checks the token', async () => {
        const env = KEYS as unknown as CloudflareEnv;
        const res = await guardPublicForm(form(), env, { action: 'register', key: 'k', unreachable: 'refuse' });
        expect(res?.status).toBe(403);
        expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), env, 'k');
    });
});

describe('the site key in the document', () => {
    const html = () =>
        new Response('<html><head><title>x</title></head><body></body></html>', {
            headers: { 'Content-Type': 'text/html', ETag: '"abc"' },
        });

    it('adds the meta tag and drops the asset validators', async () => {
        const res = await injectTurnstileSiteKey(html(), KEYS);
        const text = await res.text();
        expect(text).toContain(`<meta name="turnstile-site-key" content="${KEYS.TURNSTILE_SITE_KEY}">`);
        expect(text.indexOf('turnstile-site-key')).toBeLessThan(text.indexOf('</head>'));
        expect(res.headers.get('ETag')).toBeNull();
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('leaves the document alone when off, and refuses a key that is not a key', async () => {
        const original = html();
        expect(await injectTurnstileSiteKey(original, {})).toBe(original);
        expect(turnstileMetaTag({ TURNSTILE_SITE_KEY: '"><script>', TURNSTILE_SECRET_KEY: 's' })).toBeNull();
    });
});
