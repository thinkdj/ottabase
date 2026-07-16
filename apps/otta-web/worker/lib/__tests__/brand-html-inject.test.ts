import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockBuildCriticalStyleTagDual,
    mockBuildCustomCssStyleTag,
    mockBuildEffectsStyleTag,
    mockBuildInitialConfigScriptTag,
    mockResolveConfigFromFull,
    mockResolveFullBrandConfig,
    mockGetOttabaseConfig,
} = vi.hoisted(() => ({
    mockBuildCriticalStyleTagDual: vi.fn(),
    mockBuildCustomCssStyleTag: vi.fn(),
    mockBuildEffectsStyleTag: vi.fn(),
    mockBuildInitialConfigScriptTag: vi.fn(),
    mockResolveConfigFromFull: vi.fn(),
    mockResolveFullBrandConfig: vi.fn(),
    mockGetOttabaseConfig: vi.fn(),
}));

vi.mock('@ottabase/brand-engine', () => ({
    buildCriticalStyleTagDual: mockBuildCriticalStyleTagDual,
    buildCustomCssStyleTag: mockBuildCustomCssStyleTag,
    buildEffectsStyleTag: mockBuildEffectsStyleTag,
    buildInitialConfigScriptTag: mockBuildInitialConfigScriptTag,
}));

vi.mock('@ottabase/brand-engine/persistence', () => ({
    resolveConfigFromFull: mockResolveConfigFromFull,
    resolveFullBrandConfig: mockResolveFullBrandConfig,
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: mockGetOttabaseConfig,
}));

import { injectBrandCriticalCSS } from '../brand-html-inject';

const FULL_CONFIG = {
    brandKitsMap: { default: { brandName: 'Acme' } },
    routeMappings: [],
    layoutTemplatesMap: {},
};

function htmlResponse(body = '<html><head></head><body>Hello</body></html>', headers: Record<string, string> = {}) {
    return new Response(body, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
    });
}

function htmlRequest(url = 'https://demo.ottabase.com/blog/demo-content') {
    return new Request(url, { headers: { Accept: 'text/html' } });
}

describe('injectBrandCriticalCSS', () => {
    const env = {
        OBCF_D1: {} as any,
        OBCF_KV: {} as any,
        OBCF_R2: {} as any,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOttabaseConfig.mockReturnValue({ appId: 'otta-web' });
        mockResolveFullBrandConfig.mockResolvedValue(FULL_CONFIG);
        mockResolveConfigFromFull.mockImplementation((_full, _path, mode) => ({
            theme: { colors: { primary: mode === 'dark' ? '#ffffff' : '#111111' } },
        }));
        mockBuildCriticalStyleTagDual.mockReturnValue('<style id="brand-critical">:root{--x:1}</style>');
        mockBuildEffectsStyleTag.mockReturnValue('');
        mockBuildCustomCssStyleTag.mockImplementation((css: string) =>
            css && css.trim() ? `<style id="brand-custom-css">${css}</style>` : '',
        );
        mockBuildInitialConfigScriptTag.mockReturnValue(
            '<script type="application/json" id="brand-initial-config">{"brandKitsMap":{}}</script>',
        );
    });

    it('injects critical CSS into HTML responses', async () => {
        const injected = await injectBrandCriticalCSS(htmlResponse(), htmlRequest(), env);
        const html = await injected.text();

        expect(html).toContain('<style id="brand-critical">:root{--x:1}</style>');
        expect(html).toContain('</head>');
    });

    it('resolves once with the worker-configured app id; request ?appId/header hints are ignored', async () => {
        const request = new Request('https://demo.ottabase.com/blog/demo-content?appId=tenant-b', {
            headers: { Accept: 'text/html', 'X-App-Id': 'tenant-b' },
        });

        await injectBrandCriticalCSS(htmlResponse(), request, env);

        expect(mockResolveFullBrandConfig).toHaveBeenCalledTimes(1);
        expect(mockResolveFullBrandConfig).toHaveBeenCalledWith(env, { appId: 'otta-web' });
        expect(mockResolveConfigFromFull).toHaveBeenCalledWith(FULL_CONFIG, '/blog/demo-content', 'light');
        expect(mockResolveConfigFromFull).toHaveBeenCalledWith(FULL_CONFIG, '/blog/demo-content', 'dark');
    });

    it('embeds the full brand config plus the resolved appId as a hydration script tag', async () => {
        const injected = await injectBrandCriticalCSS(htmlResponse(), htmlRequest(), env);
        const html = await injected.text();

        expect(mockBuildInitialConfigScriptTag).toHaveBeenCalledWith({ ...FULL_CONFIG, appId: 'otta-web' });
        expect(html).toContain('<script type="application/json" id="brand-initial-config">');
    });

    it('inserts payloads containing $-sequences verbatim (no String.replace expansion)', async () => {
        // $' in a replacement STRING would splice in everything after </head>;
        // the injector must use a replacer function so it stays literal.
        mockBuildInitialConfigScriptTag.mockReturnValue(
            '<script type="application/json" id="brand-initial-config">{"tagline":"only $\' left, $$ and $&"}</script>',
        );
        const body = '<html><head></head><body>MARKER-BODY</body></html>';

        const injected = await injectBrandCriticalCSS(htmlResponse(body), htmlRequest(), env);
        const html = await injected.text();

        expect(html).toContain('{"tagline":"only $\' left, $$ and $&"}');
        // Body must appear exactly once — $' expansion would duplicate it into <head>.
        expect(html.match(/MARKER-BODY/g)).toHaveLength(1);
    });

    it('strips validators and forbids caching on injected HTML so stale config can never be 304-revived', async () => {
        const response = htmlResponse(undefined, {
            ETag: '"abc123"',
            'Last-Modified': 'Wed, 01 Jul 2026 00:00:00 GMT',
            'Cache-Control': 'public, max-age=3600',
        });

        const injected = await injectBrandCriticalCSS(response, htmlRequest(), env);

        expect(injected.headers.get('ETag')).toBeNull();
        expect(injected.headers.get('Last-Modified')).toBeNull();
        expect(injected.headers.get('Cache-Control')).toBe('no-store');
        expect(injected.headers.get('Content-Type')).toContain('text/html');
    });

    it('leaves non-HTML and failed responses untouched', async () => {
        const jsonResponse = new Response('{}', { headers: { 'Content-Type': 'application/json' } });
        expect(await injectBrandCriticalCSS(jsonResponse, htmlRequest(), env)).toBe(jsonResponse);

        const notModified = new Response(null, { status: 304 });
        expect(await injectBrandCriticalCSS(notModified, htmlRequest(), env)).toBe(notModified);
    });

    it('still injects critical CSS when the hydration payload fails to serialize', async () => {
        mockBuildInitialConfigScriptTag.mockImplementation(() => {
            throw new Error('circular structure');
        });

        const injected = await injectBrandCriticalCSS(htmlResponse(), htmlRequest(), env);
        const html = await injected.text();

        expect(html).toContain('<style id="brand-critical">:root{--x:1}</style>');
        expect(html).not.toContain('brand-initial-config');
    });

    it('injects the generated effects stylesheet when the theme produces one', async () => {
        mockBuildEffectsStyleTag.mockReturnValue('<style id="brand-effects">@keyframes blink{}</style>');

        const injected = await injectBrandCriticalCSS(htmlResponse(), htmlRequest(), env);
        const html = await injected.text();

        expect(html).toContain('<style id="brand-effects">@keyframes blink{}</style>');
    });

    it('edge-injects sanitized custom CSS (no client-side FOUC for the escape hatch)', async () => {
        mockResolveConfigFromFull.mockImplementation((_full: unknown, _path: string, mode: string) => ({
            theme: { colors: { primary: mode === 'dark' ? '#ffffff' : '#111111' } },
            customCss: '.hero { background: red; }</style><script>alert(1)</script>',
        }));

        const injected = await injectBrandCriticalCSS(htmlResponse(), htmlRequest(), env);
        const html = await injected.text();

        expect(html).toContain('<style id="brand-custom-css">');
        expect(html).toContain('.hero { background: red; }');
        // sanitizeCssForStyleTag neutralizes style-tag breakout + script tags
        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('injects font <link> tags for typography role URLs from both palettes', async () => {
        mockResolveConfigFromFull.mockImplementation((_full: unknown, _path: string, mode: string) => ({
            theme: {
                colors: {},
                typography: {
                    heading: { fontFamily: 'Righteous', url: 'https://fonts.googleapis.com/css2?family=Righteous' },
                    body: { fontFamily: 'Inter' },
                    ticker:
                        mode === 'dark'
                            ? { fontFamily: 'Archivo', url: 'https://fonts.googleapis.com/css2?family=Archivo' }
                            : { fontFamily: 'Archivo' },
                },
            },
        }));

        const injected = await injectBrandCriticalCSS(htmlResponse(), htmlRequest(), env);
        const html = await injected.text();

        expect(html).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Righteous">');
        // dark-only URL is also preloaded; deduped, https-only
        expect(html).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo">');
        expect(html.match(/family=Righteous/g)).toHaveLength(1);
    });

    it('returns an intact fallback response when injection fails after reading the body', async () => {
        mockBuildCriticalStyleTagDual.mockImplementation(() => {
            throw new Error('theme render failed');
        });

        const originalHtml = '<html><head></head><body>Original</body></html>';
        const fallback = await injectBrandCriticalCSS(htmlResponse(originalHtml), htmlRequest(), env);

        await expect(fallback.text()).resolves.toBe(originalHtml);
    });
});
