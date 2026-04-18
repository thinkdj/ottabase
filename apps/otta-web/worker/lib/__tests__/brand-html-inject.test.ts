import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBuildCriticalStyleTagDual, mockResolveBrandConfig } = vi.hoisted(() => ({
    mockBuildCriticalStyleTagDual: vi.fn(),
    mockResolveBrandConfig: vi.fn(),
}));

vi.mock('@ottabase/brand-engine', () => ({
    buildCriticalStyleTagDual: mockBuildCriticalStyleTagDual,
}));

vi.mock('@ottabase/brand-engine/persistence', () => ({
    resolveBrandConfig: mockResolveBrandConfig,
}));

import { injectBrandCriticalCSS } from '../brand-html-inject';

describe('injectBrandCriticalCSS', () => {
    const env = {
        OBCF_D1: {} as any,
        OBCF_KV: {} as any,
        OBCF_R2: {} as any,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveBrandConfig.mockResolvedValue({
            theme: { colors: { primary: '#111111' } },
            darkTheme: { colors: { primary: '#ffffff' } },
        });
        mockBuildCriticalStyleTagDual.mockReturnValue('<style id="brand-critical">:root{--x:1}</style>');
    });

    it('injects critical CSS into HTML responses', async () => {
        const response = new Response('<html><head></head><body>Hello</body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
        const request = new Request('https://demo.ottabase.com/blog/demo-content', {
            headers: { Accept: 'text/html' },
        });

        const injected = await injectBrandCriticalCSS(response, request, env);
        const html = await injected.text();

        expect(html).toContain('<style id="brand-critical">:root{--x:1}</style>');
        expect(html).toContain('</head>');
    });

    it('returns an intact fallback response when injection fails after reading the body', async () => {
        mockBuildCriticalStyleTagDual.mockImplementation(() => {
            throw new Error('theme render failed');
        });

        const originalHtml = '<html><head></head><body>Original</body></html>';
        const response = new Response(originalHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
        const request = new Request('https://demo.ottabase.com/blog/demo-content', {
            headers: { Accept: 'text/html' },
        });

        const fallback = await injectBrandCriticalCSS(response, request, env);

        await expect(fallback.text()).resolves.toBe(originalHtml);
    });
});
