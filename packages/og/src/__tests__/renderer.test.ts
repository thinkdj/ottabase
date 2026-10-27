import { describe, expect, it, vi } from 'vitest';
import { createOgRenderer, type OgBucket } from '../renderer';

const PNG = new Uint8Array([137, 80, 78, 71]).buffer;

function fakeBrowser(status = 200) {
    const calls: unknown[] = [];
    return {
        calls,
        quickAction: vi.fn(async (_action: string, options: unknown) => {
            calls.push(options);
            return new Response(status === 200 ? PNG : 'nope', {
                status,
                headers: { 'content-type': 'image/png', 'X-Browser-Ms-Used': '120' },
            });
        }),
    };
}

function fakeBucket(): OgBucket & { objects: Map<string, ArrayBuffer> } {
    const objects = new Map<string, ArrayBuffer>();
    return {
        objects,
        async get(key) {
            const found = objects.get(key);
            return found ? { arrayBuffer: async () => found } : null;
        },
        async put(key, value) {
            objects.set(key, value);
        },
    };
}

describe('createOgRenderer', () => {
    it('renders the template at the card size, keeps the PNG, and serves it from the bucket after', async () => {
        const browser = fakeBrowser();
        const bucket = fakeBucket();
        const renderer = createOgRenderer({ browser, bucket, template: (card) => `<h1>${card.title}</h1>` });

        const first = await renderer.render({ title: 'Hello' });
        expect(first).toMatchObject({ ok: true, value: { cached: false } });
        expect(browser.calls[0]).toMatchObject({
            html: '<h1>Hello</h1>',
            viewport: { width: 1200, height: 630 },
            screenshotOptions: { type: 'png' },
        });
        expect([...bucket.objects.keys()]).toEqual([await renderer.key({ title: 'Hello' })]);
        expect(bucket.objects.keys().next().value).toMatch(/^og\/[0-9a-f]{64}\.png$/);

        const second = await renderer.render({ title: 'Hello' });
        expect(second).toMatchObject({ ok: true, value: { cached: true } });
        expect(browser.quickAction).toHaveBeenCalledTimes(1);
    });

    it('renders every time without a bucket, and hands a browser failure back', async () => {
        const browser = fakeBrowser();
        const renderer = createOgRenderer({ browser });
        await renderer.render({ title: 'a' });
        await renderer.render({ title: 'a' });
        expect(browser.quickAction).toHaveBeenCalledTimes(2);

        const failing = createOgRenderer({ browser: fakeBrowser(500) });
        const result = await failing.render({ title: 'a' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/500/);
    });

    it('keys by the template version, so a new template redraws', async () => {
        const browser = fakeBrowser();
        const one = createOgRenderer({ browser, version: 'v1' });
        const two = createOgRenderer({ browser, version: 'v2' });
        expect(await one.key({ title: 'a' })).not.toBe(await two.key({ title: 'a' }));
        expect(await one.key({ title: 'a' })).toMatch(/^og\//);
        expect(await createOgRenderer({ browser, prefix: 'social/' }).key({ title: 'a' })).toMatch(/^social\//);
    });
});
