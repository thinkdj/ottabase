import { createPackageRegistry } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { describe, expect, it, vi } from 'vitest';
import { createOgPackage, ogImageUrl, registerOgTemplateSource } from '../index';

type Env = {
    browser?: { quickAction: (action: string, options: unknown) => Promise<Response> } | null;
    secret?: string;
};

const PNG = new Uint8Array([137, 80, 78, 71]).buffer;
const browser = {
    quickAction: vi.fn(
        async (_action: string, _options: unknown) => new Response(PNG, { headers: { 'content-type': 'image/png' } }),
    ),
};

function app(extra: Partial<Parameters<typeof createOgPackage<Env>>[0]> = {}) {
    const pkg = createOgPackage<Env>({
        getBrowserBinding: (env) => env.browser,
        secret: (env) => env.secret,
        defaults: () => ({ siteName: 'Acme', domain: 'acme.test', accent: '#ff0000' }),
        ...extra,
    });
    const router = new Router<Env>();
    const routes = [pkg.routes!].flat()[0]!;
    router.mount(routes.basePath, routes.build({} as never));
    createPackageRegistry<Env>({ packages: [pkg] });
    const call = (url: string, env: Env = { browser, secret: 's3cret' }) =>
        router.handle(new Request(url), env, { waitUntil() {}, passThroughOnException() {} });
    return { pkg, call };
}

describe('GET /api/og/image', () => {
    it('serves the PNG of a signed card, cacheable, with the defaults filled in', async () => {
        const { call } = app();
        browser.quickAction.mockClear();
        const url = await ogImageUrl('https://acme.test', { title: 'Hello', eyebrow: 'Blog' }, 's3cret');
        const response = await call(url);
        expect(response?.status).toBe(200);
        expect(response?.headers.get('content-type')).toBe('image/png');
        expect(response?.headers.get('cache-control')).toBe('public, max-age=86400');
        expect(response?.headers.get('x-og-cache')).toBe('miss');
        const options = browser.quickAction.mock.calls[0]![1] as { html: string };
        expect(options.html).toContain('<b>Acme</b>');
        expect(options.html).toContain('acme.test');
        expect(options.html).toContain('#ff0000');
    });

    it('refuses an unsigned or tampered URL, a bad card, and a missing secret', async () => {
        const { call } = app();
        const signed = await ogImageUrl('https://acme.test', { title: 'Hello' }, 's3cret');
        expect((await call('https://acme.test/api/og/image?title=Hello'))?.status).toBe(403);
        expect((await call(signed.replace('title=Hello', 'title=Other')))?.status).toBe(403);
        expect((await call('https://acme.test/api/og/image?sig=x'))?.status).toBe(400);
        expect((await call(signed, { browser }))?.status).toBe(503);
        expect((await call(signed, { browser: null, secret: 's3cret' }))?.status).toBe(503);
    });

    it('serves unsigned URLs when open, and a 502 when the browser fails', async () => {
        const { call } = app({ open: true });
        expect((await call('https://acme.test/api/og/image?title=Hello', { browser }))?.status).toBe(200);
        const failing = { quickAction: async () => new Response('x', { status: 500 }) };
        const response = await call('https://acme.test/api/og/image?title=Hello', { browser: failing });
        expect(response?.status).toBe(502);
        expect(((await response?.json()) as { code: string }).code).toBe('OG_RENDER_FAILED');
    });

    it('previews the card as HTML, signed the same way', async () => {
        const { call } = app();
        const url = (await ogImageUrl('https://acme.test', { title: 'Hello <b>' }, 's3cret')).replace(
            '/image?',
            '/preview?',
        );
        const response = await call(url);
        expect(response?.status).toBe(200);
        expect(response?.headers.get('content-type')).toContain('text/html');
        expect(await response?.text()).toContain('Hello &lt;b&gt;');
    });

    it('reports its health from the bindings', () => {
        const { pkg } = app();
        expect(pkg.health!({ browser, secret: 's' })).toMatchObject({ ok: true });
        expect(pkg.health!({ browser })).toMatchObject({
            ok: false,
            detail: expect.stringContaining('no signing secret'),
        });
        expect(pkg.health!({ secret: 's' })).toMatchObject({
            ok: false,
            detail: expect.stringContaining('no Browser'),
        });
    });
});

describe('another template per request', () => {
    it('draws with the source the option names, or the registered one, and keys the cache by its version', async () => {
        const seen: string[] = [];
        const custom = { template: (card: { title: string }) => `<p>custom ${card.title}</p>`, version: 'studio-7' };
        const { call } = app({ templates: (_env, _request, card) => (card.eyebrow === 'Blog' ? custom : null) });
        browser.quickAction.mockImplementation(async (_action: string, options: unknown) => {
            seen.push((options as { html: string }).html);
            return new Response(PNG, { headers: { 'content-type': 'image/png' } });
        });
        await call(await ogImageUrl('https://acme.test', { title: 'a', eyebrow: 'Blog' }, 's3cret'));
        await call(await ogImageUrl('https://acme.test', { title: 'a' }, 's3cret'));
        expect(seen[0]).toBe('<p>custom a</p>');
        expect(seen[1]).toContain('<h1 class="title">a</h1>');

        registerOgTemplateSource(() => custom);
        const fallback = app();
        const preview = await fallback.call(
            (await ogImageUrl('https://acme.test', { title: 'b' }, 's3cret')).replace('/image?', '/preview?'),
        );
        expect(await preview?.text()).toBe('<p>custom b</p>');
        registerOgTemplateSource(null);
    });
});
