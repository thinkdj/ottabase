import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The package handler is the password check itself; these tests cover the gate blog.ts puts in front of it.
const { mockUnlock } = vi.hoisted(() => ({
    mockUnlock: vi.fn(async () => new Response(JSON.stringify({ id: 'post-1', content: 'secret' }), { status: 200 })),
}));

vi.mock('@ottabase/ottablog/router', () => ({
    createBlogHandlers: () => ({ handleBlogPostUnlock: mockUnlock }),
}));

import { handleBlogPostUnlock } from '../blog';

const KEYS = { TURNSTILE_SITE_KEY: '0x4AAAAAAA-site_key', TURNSTILE_SECRET_KEY: 'secret' };

function unlockContext(env: Record<string, unknown>, headers: Record<string, string> = {}) {
    const request = new Request('https://example.com/api/blog/posts/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
        body: JSON.stringify({ slug: 'locked-post', password: 'guess' }),
    });
    return { request, env: env as unknown as CloudflareEnv, url: new URL(request.url) };
}

/** A rate limiter binding that lets everything through and records the keys it counted. */
function limiter() {
    const keys: string[] = [];
    return { keys, binding: { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) } };
}

/** Cloudflare's siteverify answering a genuine token minted for `action` on example.com. */
function mockSiteverify(action: string) {
    const fetchMock = vi.fn(async () =>
        Response.json({ success: true, action, hostname: 'example.com', 'error-codes': [] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('handleBlogPostUnlock (rate limit and Turnstile)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it('answers 403 TURNSTILE_FAILED without a token when both keys are set, before the password is checked', async () => {
        const { binding } = limiter();
        const response = await handleBlogPostUnlock(unlockContext({ ...KEYS, OBCF_RATE_LIMITER: binding }));
        const body = (await response.json()) as { code: string };

        expect(response.status).toBe(403);
        expect(body.code).toBe('TURNSTILE_FAILED');
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it('checks the password once siteverify accepts a post-unlock token', async () => {
        const fetchMock = mockSiteverify('post-unlock');
        const { binding } = limiter();
        const response = await handleBlogPostUnlock(
            unlockContext({ ...KEYS, OBCF_RATE_LIMITER: binding }, { 'X-Turnstile-Token': 'token' }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(mockUnlock).toHaveBeenCalledOnce();
        // The package handler still reads the body: the gate only read a clone.
        const forwarded = (mockUnlock.mock.calls[0] as unknown as [{ request: Request }])[0].request;
        await expect(forwarded.json()).resolves.toEqual({ slug: 'locked-post', password: 'guess' });
    });

    it('refuses a token minted for another form', async () => {
        mockSiteverify('signin');
        const { binding } = limiter();
        const response = await handleBlogPostUnlock(
            unlockContext({ ...KEYS, OBCF_RATE_LIMITER: binding }, { 'X-Turnstile-Token': 'token' }),
        );

        expect(response.status).toBe(403);
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it('rate limits per IP and post, and skips Turnstile when the keys are unset', async () => {
        const { keys, binding } = limiter();
        const response = await handleBlogPostUnlock(unlockContext({ OBCF_RATE_LIMITER: binding }));

        expect(response.status).toBe(200);
        expect(keys).toEqual(['blog:unlock:203.0.113.7:locked-post']);
        expect(mockUnlock).toHaveBeenCalledOnce();
    });

    it('answers 429 once the limiter says no, without asking Cloudflare', async () => {
        const fetchMock = mockSiteverify('post-unlock');
        const response = await handleBlogPostUnlock(
            unlockContext(
                { ...KEYS, OBCF_RATE_LIMITER: { limit: async () => ({ success: false }) } },
                { 'X-Turnstile-Token': 'token' },
            ),
        );

        expect(response.status).toBe(429);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockUnlock).not.toHaveBeenCalled();
    });
});
