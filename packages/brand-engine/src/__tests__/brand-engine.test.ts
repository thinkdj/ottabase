import { describe, it, expect, beforeEach } from 'vitest';
import {
    // Types tested indirectly through functions
    deepMerge,
    resolveAliases,
    resolveTheme,
    buildCSSVarMap,
    injectCSSVars,
    fromLegacyThemeConfig,
    registerTheme,
    registerThemes,
    getThemeByName,
    getThemeOrDefault,
    getRegisteredThemeNames,
    clearThemeRegistry,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_COLORS_DARK,
    DEFAULT_SHADOWS,
    DEFAULT_MOTION,
    DEFAULT_CURSORS,
    DEFAULT_SPACING,
    DEFAULT_LAYOUT,
} from '../index';
import type { BrandTheme, TokenColors, ResolvedBrandTheme } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid BrandTheme fixture */
function makeTheme(overrides: Partial<BrandTheme> = {}): BrandTheme {
    return {
        name: 'test',
        tokens: {
            color: {
                light: { ...DEFAULT_COLORS_LIGHT },
                dark: { ...DEFAULT_COLORS_DARK },
            },
            typography: {
                heading: { fontFamily: 'Inter' },
                body: { fontFamily: 'Inter' },
                handwriting: { fontFamily: 'Caveat' },
            },
        },
        ...overrides,
    };
}

// ===========================================================================
// deepMerge
// ===========================================================================

describe('deepMerge', () => {
    it('merges flat objects', () => {
        const result = deepMerge({ a: '1', b: '2' }, { b: '3', c: '4' } as any);
        expect(result).toEqual({ a: '1', b: '3', c: '4' });
    });

    it('deep-merges nested objects', () => {
        const target = { nested: { x: 1, y: 2 }, top: 'a' };
        const source = { nested: { y: 99, z: 3 } };
        const result = deepMerge(target, source as any);
        expect(result).toEqual({ nested: { x: 1, y: 99, z: 3 }, top: 'a' });
    });

    it('does not mutate originals', () => {
        const target = { a: { b: 1 } };
        const source = { a: { c: 2 } };
        const result = deepMerge(target, source as any);
        expect(result.a).toEqual({ b: 1, c: 2 });
        expect(target.a).toEqual({ b: 1 }); // original unchanged
    });

    it('replaces arrays (no array merge)', () => {
        const result = deepMerge({ arr: [1, 2] }, { arr: [3] } as any);
        expect(result.arr).toEqual([3]);
    });

    it('ignores undefined source values', () => {
        const result = deepMerge({ a: '1' }, { a: undefined } as any);
        expect(result.a).toBe('1');
    });
});

// ===========================================================================
// resolveAliases
// ===========================================================================

describe('resolveAliases', () => {
    it('maps alias keys to existing token values', () => {
        const palette: TokenColors = {
            ...DEFAULT_COLORS_LIGHT,
            primary: '200 50% 50%',
        };
        const result = resolveAliases(palette, { brand: 'primary' });
        expect(result['brand']).toBe('200 50% 50%');
    });

    it('preserves original tokens', () => {
        const palette: TokenColors = {
            ...DEFAULT_COLORS_LIGHT,
            primary: '200 50% 50%',
        };
        const result = resolveAliases(palette, { brand: 'primary' });
        expect(result.primary).toBe('200 50% 50%');
    });

    it('returns palette unchanged when aliases is undefined', () => {
        const result = resolveAliases(DEFAULT_COLORS_LIGHT);
        expect(result).toEqual(DEFAULT_COLORS_LIGHT);
    });

    it('skips aliases whose target does not exist in palette', () => {
        const result = resolveAliases(DEFAULT_COLORS_LIGHT, { ghost: 'nonexistent' });
        expect(result['ghost']).toBeUndefined();
    });
});

// ===========================================================================
// resolveTheme
// ===========================================================================

describe('resolveTheme', () => {
    it('returns a ResolvedBrandTheme with all required fields', () => {
        const theme = makeTheme();
        const resolved = resolveTheme({ base: theme, mode: 'light' });

        expect(resolved.name).toBe('test');
        expect(resolved.colors.primary).toBe(DEFAULT_COLORS_LIGHT.primary);
        expect(resolved.typography.heading.fontFamily).toBe('Inter');
        expect(resolved.radius).toBe('0.5rem');
        expect(resolved.shadows).toEqual(DEFAULT_SHADOWS);
        expect(resolved.motion).toEqual(DEFAULT_MOTION);
        expect(resolved.layout).toEqual(DEFAULT_LAYOUT);
    });

    it('selects dark palette when mode is dark', () => {
        const theme = makeTheme();
        const resolved = resolveTheme({ base: theme, mode: 'dark' });
        expect(resolved.colors.background).toBe(DEFAULT_COLORS_DARK.background);
    });

    it('applies tenant overrides via deep merge', () => {
        const base = makeTheme();
        const resolved = resolveTheme({
            base,
            tenantOverrides: {
                tokens: {
                    color: {
                        light: { ...DEFAULT_COLORS_LIGHT, primary: '0 100% 50%' },
                        dark: DEFAULT_COLORS_DARK,
                    },
                    typography: base.tokens.typography,
                    radius: '1rem',
                },
            },
            mode: 'light',
        });
        expect(resolved.colors.primary).toBe('0 100% 50%');
        expect(resolved.radius).toBe('1rem');
    });

    it('resolves token aliases', () => {
        const theme = makeTheme({
            tokens: {
                color: {
                    light: { ...DEFAULT_COLORS_LIGHT, primary: '120 80% 40%' },
                    dark: DEFAULT_COLORS_DARK,
                },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
                aliases: { brand: 'primary' },
            },
        });
        const resolved = resolveTheme({ base: theme, mode: 'light' });
        expect(resolved.colors['brand']).toBe('120 80% 40%');
    });

    it('uses custom layout when provided', () => {
        const theme = makeTheme({
            layout: {
                header: 'minimal',
                navigation: 'drawer',
                contentWidth: 'full',
                footer: false,
                density: 'compact',
            },
        });
        const resolved = resolveTheme({ base: theme });
        expect(resolved.layout.header).toBe('minimal');
        expect(resolved.layout.density).toBe('compact');
        expect(resolved.layout.footer).toBe(false);
    });

    it('defaults mode to light', () => {
        const theme = makeTheme();
        const resolved = resolveTheme({ base: theme });
        expect(resolved.colors.background).toBe(DEFAULT_COLORS_LIGHT.background);
    });
});

// ===========================================================================
// buildCSSVarMap
// ===========================================================================

describe('buildCSSVarMap', () => {
    let resolved: ResolvedBrandTheme;

    beforeEach(() => {
        resolved = resolveTheme({ base: makeTheme(), mode: 'light' });
    });

    it('includes typography vars', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--font-heading']).toBe('Inter');
        expect(vars['--font-body']).toBe('Inter');
        expect(vars['--font-handwriting']).toBe('Caveat');
    });

    it('includes colour tokens as --<token>', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--primary']).toBe(DEFAULT_COLORS_LIGHT.primary);
        expect(vars['--background']).toBe(DEFAULT_COLORS_LIGHT.background);
    });

    it('includes radius', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--radius']).toBe('0.5rem');
    });

    it('includes shadow elevation tokens', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--shadow-xs']).toBe(DEFAULT_SHADOWS.xs);
        expect(vars['--shadow-xl']).toBe(DEFAULT_SHADOWS.xl);
    });

    it('includes motion tokens', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--duration-fast']).toBe(DEFAULT_MOTION.durationFast);
        expect(vars['--ease']).toBe(DEFAULT_MOTION.easing);
    });

    it('includes spacing tokens', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--spacing-section']).toBe(DEFAULT_SPACING.section);
        expect(vars['--spacing-card']).toBe(DEFAULT_SPACING.card);
    });

    it('includes layout vars', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--layout-header']).toBe('topbar');
        expect(vars['--layout-navigation']).toBe('sidebar');
        expect(vars['--layout-content-width']).toBe('fluid');
        expect(vars['--layout-footer']).toBe('1');
        expect(vars['--layout-density']).toBe('comfy');
    });

    it('includes cursor vars', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--cursor-default']).toBe('auto');
        expect(vars['--cursor-pointer']).toBe('pointer');
    });
});

// ===========================================================================
// injectCSSVars
// ===========================================================================

describe('injectCSSVars', () => {
    it('calls setProperty for each var', () => {
        const calls: [string, string][] = [];
        const mockStyle = {
            setProperty(prop: string, val: string) {
                calls.push([prop, val]);
            },
        };
        injectCSSVars(mockStyle, { '--a': '1', '--b': '2' });
        expect(calls).toEqual([
            ['--a', '1'],
            ['--b', '2'],
        ]);
    });
});

// ===========================================================================
// fromLegacyThemeConfig (adapter)
// ===========================================================================

describe('fromLegacyThemeConfig', () => {
    it('converts a legacy ThemeConfig JSON into a BrandTheme', () => {
        const legacy = {
            name: 'default',
            typography: {
                heading: { fontFamily: 'Inter', url: 'https://fonts.example.com/inter' },
                body: { fontFamily: 'Inter', url: 'https://fonts.example.com/inter' },
                handwriting: { fontFamily: 'Caveat', url: 'https://fonts.example.com/caveat' },
            },
            colors: {
                light: { background: '0 0% 100%', foreground: '222 84% 5%' },
                dark: { background: '222 84% 5%', foreground: '210 40% 98%' },
            },
            radius: '0.5rem',
            spacing: { section: '2rem' },
            shadows: { xs: 'custom-shadow' },
            motion: { durationFast: '80ms' },
            appearance: { cursors: { default: 'crosshair' } },
        };

        const brand = fromLegacyThemeConfig(legacy);

        expect(brand.name).toBe('default');
        expect(brand.tokens.typography.heading.fontFamily).toBe('Inter');
        expect(brand.tokens.color.light.background).toBe('0 0% 100%');
        expect(brand.tokens.radius).toBe('0.5rem');
        expect(brand.tokens.spacing).toEqual({ section: '2rem' });
        expect(brand.tokens.shadow?.xs).toBe('custom-shadow');
        expect(brand.tokens.motion?.durationFast).toBe('80ms');
        expect(brand.cursors?.default).toBe('crosshair');
    });

    it('handles missing optional fields', () => {
        const legacy = {
            name: 'minimal',
            typography: {
                heading: { fontFamily: 'System' },
                body: { fontFamily: 'System' },
                handwriting: { fontFamily: 'System' },
            },
            colors: {
                light: { background: '0 0% 100%' } as any,
                dark: { background: '0 0% 0%' } as any,
            },
        };

        const brand = fromLegacyThemeConfig(legacy);
        expect(brand.tokens.spacing).toBeUndefined();
        expect(brand.tokens.shadow).toBeUndefined();
        expect(brand.cursors).toBeUndefined();
    });
});

// ===========================================================================
// Registry
// ===========================================================================

describe('Theme Registry', () => {
    beforeEach(() => {
        clearThemeRegistry();
    });

    it('registers and retrieves a theme by name', () => {
        const theme = makeTheme({ name: 'brand-a' });
        registerTheme(theme);
        expect(getThemeByName('brand-a')).toBe(theme);
    });

    it('registerThemes registers multiple themes', () => {
        registerThemes([makeTheme({ name: 'a' }), makeTheme({ name: 'b' })]);
        expect(getRegisteredThemeNames()).toEqual(['a', 'b']);
    });

    it('getThemeOrDefault falls back to default', () => {
        registerTheme(makeTheme({ name: 'default' }));
        const result = getThemeOrDefault('missing');
        expect(result.name).toBe('default');
    });

    it('getThemeOrDefault falls back to first registered when default is missing', () => {
        registerTheme(makeTheme({ name: 'first' }));
        const result = getThemeOrDefault('missing');
        expect(result.name).toBe('first');
    });

    it('getThemeByName returns undefined for unregistered name', () => {
        expect(getThemeByName('nope')).toBeUndefined();
    });

    it('clearThemeRegistry empties the registry', () => {
        registerTheme(makeTheme());
        clearThemeRegistry();
        expect(getRegisteredThemeNames()).toEqual([]);
    });
});

// ===========================================================================
// Layout defaults
// ===========================================================================

describe('Layout', () => {
    it('DEFAULT_LAYOUT has expected shape', () => {
        expect(DEFAULT_LAYOUT).toEqual({
            header: 'topbar',
            navigation: 'sidebar',
            contentWidth: 'fluid',
            footer: true,
            density: 'comfy',
        });
    });

    it('layout vars reflect custom config', () => {
        const theme = makeTheme({
            layout: {
                header: 'none',
                navigation: 'drawer',
                contentWidth: 'fixed',
                footer: false,
                density: 'compact',
            },
        });
        const resolved = resolveTheme({ base: theme });
        const vars = buildCSSVarMap(resolved);
        expect(vars['--layout-header']).toBe('none');
        expect(vars['--layout-navigation']).toBe('drawer');
        expect(vars['--layout-content-width']).toBe('fixed');
        expect(vars['--layout-footer']).toBe('0');
        expect(vars['--layout-density']).toBe('compact');
    });
});
