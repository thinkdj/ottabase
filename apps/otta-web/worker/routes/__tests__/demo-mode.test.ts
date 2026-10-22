import { describe, expect, it } from 'vitest';
import { handleDemoMode } from '../demo';

function call(env: Record<string, unknown>) {
    const request = new Request('https://app.example.com/api/demo/mode');
    return handleDemoMode({ request, env: env as any, url: new URL(request.url) }).json();
}

describe('GET /api/demo/mode', () => {
    it('reports a normal deploy, ignoring any call to action', async () => {
        expect(await call({ DEMO_CTA_LABEL: 'Get Pro', DEMO_CTA_URL: 'https://example.com' })).toEqual({
            enabled: false,
            ctaLabel: null,
            ctaUrl: null,
        });
    });

    it('reports a public demo with its call to action', async () => {
        expect(
            await call({ DEMO_MODE: 'true', DEMO_CTA_LABEL: ' Get Pro ', DEMO_CTA_URL: 'https://example.com/pro' }),
        ).toEqual({ enabled: true, ctaLabel: 'Get Pro', ctaUrl: 'https://example.com/pro' });
    });

    it('accepts 1 as on, and leaves an unset call to action empty', async () => {
        expect(await call({ DEMO_MODE: '1' })).toEqual({ enabled: true, ctaLabel: null, ctaUrl: null });
        expect(await call({ DEMO_MODE: 'false' })).toMatchObject({ enabled: false });
    });
});
