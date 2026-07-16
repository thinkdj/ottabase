// ---------------------------------------------------------------------------
// Edge ↔ client theme-derivation parity (the zero-FOUC handoff contract).
//
// The Worker paints <style id="brand-critical"> from resolveConfigFromFull
// (persistence side) and embeds the full config; the client re-derives
// themeLight/themeDark in resolveConfigForPath (brand-engine-react) and
// REPLACES the same stylesheet via applyBrandTheme. First-load must be a
// byte-identical no-op — no re-fetch, no base-theme-then-retheme flash
// (commit c365c065's optimization). These tests lock both sides together,
// including BrandEngine v2 categories and per-route token overrides.
// ---------------------------------------------------------------------------

import { buildCriticalCSSDual, type ResolvedBrandTheme } from '@ottabase/brand-engine';
import { resolveConfigFromFull } from '@ottabase/brand-engine/persistence';
import { resolveConfigForPath, type FullBrandConfig } from '@ottabase/brand-engine-react';
import { DEFAULT_LAYOUT, pathPatternToRegex } from '@ottabase/ottalayout';
import { describe, expect, it } from 'vitest';

/** Light theme with v2 categories exercised (palette/typeScale/scopes/…) */
const lightTheme = {
    name: 'marquee',
    colors: { background: '0 0% 100%', foreground: '264 9% 11%', primary: '349 74% 49%' },
    typography: {
        heading: { fontFamily: 'Archivo' },
        body: { fontFamily: 'Archivo' },
        handwriting: { fontFamily: 'cursive' },
        mono: { fontFamily: 'Spline Sans Mono' },
    },
    spacing: { section: '2rem', card: '1.5rem', element: '0.5rem' },
    radius: '8px',
    radiusScale: { sm: '4px', full: '9999px' },
    shadows: { xs: 'none', sm: 'none', md: '0 4px 12px -4px rgb(0 0 0 / 0.12)', lg: 'x', xl: 'y' },
    motion: {
        durationFast: '120ms',
        durationNormal: '200ms',
        durationSlow: '320ms',
        easing: 'e',
        easingEnter: 'e',
        easingExit: 'e',
        easingSpring: 's',
        disableAnimations: false,
    },
    palette: { upp: '#D82042', 'upp-glow': 'color-mix(in srgb, var(--upp) 36%, transparent)' },
    typeScale: { sm: { size: '13.5px', lineHeight: '1.45' } },
    interaction: { hoverTransform: 'translateY(-1px)', activeTransform: 'scale(0.97)' },
    scopes: { screen: { color: { background: '240 16% 6%' } } },
    cursors: { default: 'auto', pointer: 'pointer', text: 'text' },
    layout: DEFAULT_LAYOUT,
} as unknown as ResolvedBrandTheme;

/** Dark DELTA (what brandKitToTheme('dark') produces — colors always, splits only) */
const darkTheme = {
    colors: { background: '240 9% 7%', foreground: '30 13% 94%', primary: '349 74% 55%' },
    shadows: { xs: 'none', sm: 'none', md: 'dark-md', lg: 'dark-lg', xl: 'dark-xl' },
    palette: { 'upp-wash': 'color-mix(in oklab, var(--upp) 16%, #101013)' },
} as unknown as Partial<ResolvedBrandTheme>;

const OVERRIDES_JSON = JSON.stringify({ radius: '2px', palette: { 'route-extra': '#123456' } });

const fullConfig = {
    appId: 'otta-web',
    routeMappings: [
        {
            pathPattern: '/blog/*',
            layoutTemplateId: 'docs',
            brandKitId: 'kit-1',
            priority: 10,
            tokenOverridesJson: OVERRIDES_JSON,
        },
        { pathPattern: '/*', layoutTemplateId: 'homepage', brandKitId: 'kit-1', priority: 0 },
    ],
    layoutTemplatesMap: {
        homepage: { componentKey: 'homepage', config: DEFAULT_LAYOUT },
        docs: { componentKey: 'docs', config: DEFAULT_LAYOUT },
    },
    brandKitsMap: {
        'kit-1': {
            brandName: 'Test',
            logos: {},
            theme: lightTheme,
            darkTheme,
            defaultColorScheme: 'light',
            allowDarkModeToggle: true,
            hideOttabaseBranding: false,
        },
    },
};

/** Client-side route matcher mirroring BrandProvider's cache semantics */
function makeMatcher(mappings: typeof fullConfig.routeMappings) {
    const sorted = [...mappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return (pathname: string) => {
        for (const m of sorted) {
            if (pathPatternToRegex(m.pathPattern).test(pathname)) {
                return {
                    layoutTemplateId: m.layoutTemplateId,
                    brandKitId: m.brandKitId,
                    tokenOverridesJson: m.tokenOverridesJson,
                };
            }
        }
        return null;
    };
}

function clientResolve(path: string, mode: 'light' | 'dark') {
    return resolveConfigForPath(
        fullConfig as unknown as FullBrandConfig,
        path,
        makeMatcher(fullConfig.routeMappings),
        mode,
        fullConfig.routeMappings,
    )!;
}

describe('edge ↔ client theme parity (zero-FOUC handoff)', () => {
    it('themeLight/themeDark deep-equal the edge-resolved themes (plain route)', () => {
        const client = clientResolve('/', 'light');
        const serverLight = resolveConfigFromFull(fullConfig as never, '/', 'light')!;
        const serverDark = resolveConfigFromFull(fullConfig as never, '/', 'dark')!;

        expect(client.themeLight).toEqual(serverLight.theme);
        expect(client.themeDark).toEqual(serverDark.theme);
        // dark delta merged over light: split palette keys merge, colors replace
        expect((client.themeDark.palette as Record<string, string>)['upp']).toBe('#D82042');
        expect((client.themeDark.palette as Record<string, string>)['upp-wash']).toContain('#101013');
    });

    it('per-route token overrides derive identically on both sides', () => {
        const client = clientResolve('/blog/post-1', 'light');
        const serverLight = resolveConfigFromFull(fullConfig as never, '/blog/post-1', 'light')!;
        const serverDark = resolveConfigFromFull(fullConfig as never, '/blog/post-1', 'dark')!;

        expect(client.themeLight).toEqual(serverLight.theme);
        expect(client.themeDark).toEqual(serverDark.theme);
        expect(client.themeLight.radius).toBe('2px');
        expect((client.themeLight.palette as Record<string, string>)['route-extra']).toBe('#123456');
    });

    it('produces byte-identical critical CSS — client first-load application is a no-op', () => {
        for (const path of ['/', '/blog/post-1']) {
            const client = clientResolve(path, 'light');
            const serverLight = resolveConfigFromFull(fullConfig as never, path, 'light')!;
            const serverDark = resolveConfigFromFull(fullConfig as never, path, 'dark')!;

            const edgeCSS = buildCriticalCSSDual(
                serverLight.theme as ResolvedBrandTheme,
                serverDark.theme as ResolvedBrandTheme,
            );
            const clientCSS = buildCriticalCSSDual(client.themeLight, client.themeDark);
            expect(clientCSS).toBe(edgeCSS);
            // v2 payload actually present (guards against silently-empty themes)
            expect(edgeCSS).toContain('--upp: #D82042;');
            expect(edgeCSS).toContain('[data-brand-scope="screen"]');
        }
    });

    it('mode-picked `theme` still matches the requested mode (existing consumers)', () => {
        expect(clientResolve('/', 'light').theme).toEqual(clientResolve('/', 'light').themeLight);
        expect(clientResolve('/', 'dark').theme).toEqual(clientResolve('/', 'dark').themeDark);
    });
});
