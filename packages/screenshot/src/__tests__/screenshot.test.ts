// ============================================================
// Shot validation, the CDP runner against a scripted page, the optimizer and the route.
// ============================================================

import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { describe, expect, it, vi } from 'vitest';
import {
    captureShot,
    createScreenshotPackage,
    imagesOptimizer,
    normalizeShot,
    optimizeShot,
    screenshotOrigin,
    type CdpSend,
    type ScreenshotPuppeteer,
    type ScreenshotResponse,
} from '../index';

const PIXELS = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6]);
const PIXELS_B64 = btoa(String.fromCharCode(...PIXELS));

/** A page that loads instantly: every wait passes, every click finds its target. */
function fakePage() {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
    let stale = false;
    const send: CdpSend = async (method, params) => {
        calls.push({ method, params });
        if (method === 'Page.addScriptToEvaluateOnNewDocument') return { identifier: '1' };
        if (method === 'Page.navigate') stale = false;
        if (method === 'Page.captureScreenshot') return { data: PIXELS_B64 };
        if (method === 'Runtime.evaluate') {
            const expression = String(params?.expression);
            if (expression.includes('__ottaShotStale = true')) stale = true;
            if (expression.includes('!window.__ottaShotStale')) return { result: { value: !stale } };
            if (expression.includes('getBoundingClientRect()')) return { result: { value: { x: 10, y: 20 } } };
            return { result: { value: true } };
        }
        return {};
    };
    return { send, calls };
}

describe('normalizeShot', () => {
    it('fills defaults and maps jpg to jpeg', () => {
        expect(normalizeShot({ path: '/' })).toMatchObject({
            format: 'png',
            quality: 90,
            width: 1280,
            height: 800,
            scale: 1,
            theme: 'light',
            optimize: true,
        });
        expect(normalizeShot({ path: '/', format: 'jpg' })).toMatchObject({ format: 'jpeg', quality: 80 });
    });

    it.each([
        [{ path: 'https://evil.example/' }, /path/],
        [{ path: '//evil.example/' }, /path/],
        [{ path: '/\\evil' }, /path/],
        [{ path: '/', format: 'gif' }, /format/],
        [{ path: '/', quality: 0 }, /quality/],
        [{ path: '/', width: 10_000 }, /width/],
        [{ path: '/', scale: 4 }, /scale/],
        [{ path: '/', steps: [{ click: 'a', type: 'b' }] }, /exactly one/],
        [{ path: '/', steps: [{ eval: 'x' }] }, /one of/],
        [{ path: '/', steps: [{ wait: 60_000 }] }, /wait/],
    ])('rejects %j', (input, message) => {
        expect(() => normalizeShot(input)).toThrow(message);
    });
});

describe('captureShot', () => {
    it('emulates the viewport and theme, runs steps, encodes and cleans up', async () => {
        const page = fakePage();
        const shot = normalizeShot({ path: '/blog', format: 'webp', quality: 70, theme: 'dark', scale: 1.5 });
        shot.steps = [{ click: 'Open' }];
        const bytes = await captureShot(page.send, { origin: 'http://127.0.0.1:3003', shot });

        expect(bytes).toEqual(PIXELS);
        const by = (m: string) => page.calls.find((c) => c.method === m)?.params;
        expect(by('Emulation.setDeviceMetricsOverride')).toMatchObject({ width: 1280, deviceScaleFactor: 1.5 });
        expect(JSON.stringify(by('Emulation.setEmulatedMedia'))).toContain('"dark"');
        expect(String(by('Page.addScriptToEvaluateOnNewDocument')?.source)).toContain('ottabase.theme');
        expect(by('Page.navigate')).toEqual({ url: 'http://127.0.0.1:3003/blog' });
        expect(page.calls.filter((c) => c.method === 'Input.dispatchMouseEvent').length).toBe(4);
        expect(by('Page.captureScreenshot')).toEqual({ format: 'webp', quality: 70 });
        expect(page.calls.at(-1)?.method).toBe('Page.removeScriptToEvaluateOnNewDocument');
    });

    it('sends no quality for png', async () => {
        const page = fakePage();
        await captureShot(page.send, { origin: 'http://x.test', shot: normalizeShot({ path: '/' }) });
        expect(page.calls.find((c) => c.method === 'Page.captureScreenshot')?.params).toEqual({ format: 'png' });
    });
});

describe('optimizeShot', () => {
    const shot = normalizeShot({ path: '/' });

    it('keeps the smaller encoding', async () => {
        const smaller = vi.fn(async () => new Uint8Array(2));
        const larger = vi.fn(async () => new Uint8Array(99));
        expect(await optimizeShot(PIXELS, shot, smaller)).toEqual({
            bytes: new Uint8Array(2),
            optimization: 'applied',
        });
        expect(await optimizeShot(PIXELS, shot, larger)).toEqual({ bytes: PIXELS, optimization: 'no-gain' });
        expect((await optimizeShot(PIXELS, shot, null)).optimization).toBe('unavailable');
        expect((await optimizeShot(PIXELS, { ...shot, optimize: false }, smaller)).optimization).toBe('skipped');
    });

    it('drives the Images binding with the mime type and quality', async () => {
        const output = vi.fn(async () => ({ response: () => new Response(new Uint8Array([1, 2])) }));
        const optimize = imagesOptimizer({ input: () => ({ output }) });
        expect(await optimize(PIXELS, { format: 'jpeg', quality: 75 })).toEqual(new Uint8Array([1, 2]));
        expect(output).toHaveBeenCalledWith({ format: 'image/jpeg', quality: 75 });
    });
});

describe('screenshotOrigin', () => {
    const at = (url: string, origin?: string) =>
        screenshotOrigin(new Request(url, { headers: origin ? { Origin: origin } : {} }));

    it('follows the browser origin only between loopback hosts', () => {
        expect(at('http://127.0.0.1:3004/api/screenshot/capture', 'http://127.0.0.1:3003')).toBe(
            'http://127.0.0.1:3003',
        );
        expect(at('https://app.example/api/screenshot/capture', 'http://127.0.0.1:3003')).toBe('https://app.example');
        expect(at('http://127.0.0.1:3004/x', 'https://evil.example')).toBe('http://127.0.0.1:3004');
        expect(at('https://app.example/x')).toBe('https://app.example');
    });
});

describe('POST /api/screenshot/capture', () => {
    type Env = { browser?: boolean; signedIn?: boolean };

    function app(over: { optimizer?: boolean; limited?: boolean } = {}) {
        const page = fakePage();
        const close = vi.fn(async () => undefined);
        const puppeteer: ScreenshotPuppeteer = {
            launch: async () => ({
                newPage: async () => ({ createCDPSession: async () => ({ send: page.send }) }),
                close,
            }),
        };
        const pkg = createScreenshotPackage<Env>({
            resolveCaller: async (_request, env) => (env.signedIn ? { userId: 'u1' } : null),
            rateLimit: async () => (over.limited ? new Response('slow down', { status: 429 }) : null),
            getBrowserBinding: (env) => (env.browser ? {} : null),
            loadPuppeteer: async () => puppeteer,
            getOptimizer: () => (over.optimizer ? async () => new Uint8Array(3) : null),
        });
        const router = new Router<Env>();
        mountPackages(router, { packages: createPackageRegistry<Env>({ packages: [pkg] }) });
        const call = async (body: unknown, env: Env) =>
            (await router.handle(
                new Request('https://app.example/api/screenshot/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }),
                env,
            ))!;
        return { call, page, close, pkg };
    }

    it('requires a session', async () => {
        expect((await app().call({ path: '/' }, { browser: true })).status).toBe(401);
    });

    it('honours the rate limit', async () => {
        expect((await app({ limited: true }).call({ path: '/' }, { browser: true, signedIn: true })).status).toBe(429);
    });

    it('rejects a URL', async () => {
        const res = await app().call({ path: 'https://evil.example' }, { browser: true, signedIn: true });
        expect(res.status).toBe(400);
    });

    it('is 503 without Browser Rendering', async () => {
        expect((await app().call({ path: '/' }, { signedIn: true })).status).toBe(503);
    });

    it('captures on the request origin, optimizes and closes the browser', async () => {
        const { call, page, close } = app({ optimizer: true });
        const res = await call({ path: '/pricing', format: 'jpg', scale: 2 }, { browser: true, signedIn: true });
        expect(res.status).toBe(200);
        const { data } = (await res.json()) as { data: ScreenshotResponse };
        expect(data).toMatchObject({
            format: 'jpeg',
            mimeType: 'image/jpeg',
            originalBytes: PIXELS.byteLength,
            bytes: 3,
            optimization: 'applied',
            width: 2560,
            height: 1600,
        });
        expect(data.dataUrl).toBe(`data:image/jpeg;base64,${btoa('\0\0\0')}`);
        expect(page.calls.find((c) => c.method === 'Page.navigate')?.params).toEqual({
            url: 'https://app.example/pricing',
        });
        expect(close).toHaveBeenCalled();
    });

    it('reports its binding in health', () => {
        const { pkg } = app();
        expect(pkg.health?.({ browser: true })).toMatchObject({ ok: true });
        expect(pkg.health?.({})).toMatchObject({ ok: false });
    });
});
