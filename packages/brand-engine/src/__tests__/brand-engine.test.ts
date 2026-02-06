import { beforeEach, describe, expect, it } from 'vitest';
import type { BrandTheme, ResolvedBrandTheme, TokenColors } from '../index';
import {
    buildCSSVarMap,
    clearThemeRegistry,
    // Types tested indirectly through functions
    deepMerge,
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_LAYOUT,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
    fromLegacyThemeConfig,
    getRegisteredThemeNames,
    getThemeByName,
    getThemeOrDefault,
    injectCSSVars,
    registerTheme,
    registerThemes,
    resolveAliases,
    resolveTheme,
} from '../index';

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

    it('handles deeply nested merge (3+ levels)', () => {
        const target = { a: { b: { c: 1, d: 2 }, e: 3 } };
        const source = { a: { b: { c: 99 } } };
        const result = deepMerge(target, source as any);
        expect(result).toEqual({ a: { b: { c: 99, d: 2 }, e: 3 } });
    });

    it('replaces primitives with objects', () => {
        const result = deepMerge({ a: 'string' }, { a: { nested: true } } as any);
        expect(result.a).toEqual({ nested: true });
    });

    it('handles empty source', () => {
        const target = { a: 1, b: 2 };
        const result = deepMerge(target, {});
        expect(result).toEqual({ a: 1, b: 2 });
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

    it('uses custom cursors when provided on theme', () => {
        const theme = makeTheme({
            cursors: { default: 'url(custom.svg), auto', pointer: 'url(hand.svg), pointer' },
        });
        const resolved = resolveTheme({ base: theme });
        expect(resolved.cursors?.default).toBe('url(custom.svg), auto');
        expect(resolved.cursors?.pointer).toBe('url(hand.svg), pointer');
    });

    it('falls back to DEFAULT_CURSORS when no cursors provided', () => {
        const theme = makeTheme();
        const resolved = resolveTheme({ base: theme });
        expect(resolved.cursors).toEqual(DEFAULT_CURSORS);
    });

    it('falls back to DEFAULT_LAYOUT when no layout provided', () => {
        const theme = makeTheme();
        const resolved = resolveTheme({ base: theme });
        expect(resolved.layout).toEqual(DEFAULT_LAYOUT);
    });

    it('merges tenant layout overrides with base layout', () => {
        const base = makeTheme({
            layout: {
                header: 'topbar',
                navigation: 'sidebar',
                contentWidth: 'fluid',
                footer: true,
                density: 'comfy',
            },
        });
        const resolved = resolveTheme({
            base,
            tenantOverrides: {
                layout: {
                    header: 'minimal',
                    navigation: 'sidebar',
                    contentWidth: 'fluid',
                    footer: true,
                    density: 'compact',
                },
            },
        });
        expect(resolved.layout.header).toBe('minimal');
        expect(resolved.layout.density).toBe('compact');
    });

    it('uses DEFAULT_SPACING when spacing is not provided', () => {
        const theme = makeTheme();
        const resolved = resolveTheme({ base: theme });
        expect(resolved.spacing).toEqual(DEFAULT_SPACING);
    });

    it('uses custom spacing when provided', () => {
        const theme = makeTheme({
            tokens: {
                color: { light: DEFAULT_COLORS_LIGHT, dark: DEFAULT_COLORS_DARK },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
                spacing: { section: '4rem', card: '2rem', element: '1rem' },
            },
        });
        const resolved = resolveTheme({ base: theme });
        expect(resolved.spacing.section).toBe('4rem');
    });

    it('merges shadow overrides with defaults', () => {
        const theme = makeTheme({
            tokens: {
                color: { light: DEFAULT_COLORS_LIGHT, dark: DEFAULT_COLORS_DARK },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
                shadow: { xs: 'custom-xs-shadow' },
            },
        });
        const resolved = resolveTheme({ base: theme });
        expect(resolved.shadows.xs).toBe('custom-xs-shadow');
        // Other shadow levels should still have defaults
        expect(resolved.shadows.sm).toBe(DEFAULT_SHADOWS.sm);
    });

    it('merges motion overrides with defaults', () => {
        const theme = makeTheme({
            tokens: {
                color: { light: DEFAULT_COLORS_LIGHT, dark: DEFAULT_COLORS_DARK },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
                motion: { durationFast: '50ms' },
            },
        });
        const resolved = resolveTheme({ base: theme });
        expect(resolved.motion.durationFast).toBe('50ms');
        expect(resolved.motion.durationNormal).toBe(DEFAULT_MOTION.durationNormal);
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
        expect(vars['--font-heading']).toBe('"Inter", sans-serif');
        expect(vars['--font-body']).toBe('"Inter", sans-serif');
        expect(vars['--font-handwriting']).toBe('"Caveat", cursive');
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

    it('includes custom cursor vars from theme config', () => {
        const theme = makeTheme({
            cursors: {
                default: 'url(data:image/svg+xml,...), auto',
                pointer: 'url(data:image/svg+xml,...), pointer',
                grab: 'grab',
            },
        });
        const customResolved = resolveTheme({ base: theme, mode: 'light' });
        const vars = buildCSSVarMap(customResolved);
        expect(vars['--cursor-default']).toBe('url(data:image/svg+xml,...), auto');
        expect(vars['--cursor-grab']).toBe('grab');
    });

    it('omits spacing vars when spacing is empty', () => {
        // Resolved always has spacing (defaults), but verify var naming
        const vars = buildCSSVarMap(resolved);
        expect(vars['--spacing-element']).toBe(DEFAULT_SPACING.element);
    });

    it('generates all shadow level vars', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--shadow-xs']).toBeDefined();
        expect(vars['--shadow-sm']).toBeDefined();
        expect(vars['--shadow-md']).toBeDefined();
        expect(vars['--shadow-lg']).toBeDefined();
        expect(vars['--shadow-xl']).toBeDefined();
    });

    it('generates all motion vars', () => {
        const vars = buildCSSVarMap(resolved);
        expect(vars['--duration-fast']).toBeDefined();
        expect(vars['--duration-normal']).toBeDefined();
        expect(vars['--duration-slow']).toBeDefined();
        expect(vars['--ease']).toBeDefined();
        expect(vars['--ease-enter']).toBeDefined();
        expect(vars['--ease-exit']).toBeDefined();
    });

    it('dark mode produces different colour vars than light', () => {
        const darkResolved = resolveTheme({ base: makeTheme(), mode: 'dark' });
        const lightVars = buildCSSVarMap(resolved);
        const darkVars = buildCSSVarMap(darkResolved);
        expect(darkVars['--background']).not.toBe(lightVars['--background']);
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

    it('reads cursors from top-level (flat format, preferred)', () => {
        const legacy = {
            name: 'flat',
            typography: {
                heading: { fontFamily: 'Inter' },
                body: { fontFamily: 'Inter' },
                handwriting: { fontFamily: 'Inter' },
            },
            colors: {
                light: { background: '0 0% 100%' } as any,
                dark: { background: '0 0% 0%' } as any,
            },
            cursors: { default: 'url(arrow.svg), auto', pointer: 'url(hand.svg), pointer' },
        };

        const brand = fromLegacyThemeConfig(legacy);
        expect(brand.cursors?.default).toBe('url(arrow.svg), auto');
        expect(brand.cursors?.pointer).toBe('url(hand.svg), pointer');
    });

    it('top-level cursors take precedence over appearance.cursors', () => {
        const legacy = {
            name: 'both',
            typography: {
                heading: { fontFamily: 'Inter' },
                body: { fontFamily: 'Inter' },
                handwriting: { fontFamily: 'Inter' },
            },
            colors: {
                light: { background: '0 0% 100%' } as any,
                dark: { background: '0 0% 0%' } as any,
            },
            cursors: { default: 'top-level-cursor' },
            appearance: { cursors: { default: 'legacy-cursor' } },
        };

        const brand = fromLegacyThemeConfig(legacy);
        expect(brand.cursors?.default).toBe('top-level-cursor');
    });

    it('passes layout config through to BrandTheme', () => {
        const legacy = {
            name: 'with-layout',
            typography: {
                heading: { fontFamily: 'Inter' },
                body: { fontFamily: 'Inter' },
                handwriting: { fontFamily: 'Inter' },
            },
            colors: {
                light: { background: '0 0% 100%' } as any,
                dark: { background: '0 0% 0%' } as any,
            },
            layout: {
                header: 'minimal',
                navigation: 'drawer',
                contentWidth: 'full',
                footer: false,
                density: 'compact',
            },
        };

        const brand = fromLegacyThemeConfig(legacy);
        expect(brand.layout).toEqual({
            header: 'minimal',
            navigation: 'drawer',
            contentWidth: 'full',
            footer: false,
            density: 'compact',
        });
    });

    it('layout is undefined when not provided in legacy config', () => {
        const legacy = {
            name: 'no-layout',
            typography: {
                heading: { fontFamily: 'Inter' },
                body: { fontFamily: 'Inter' },
                handwriting: { fontFamily: 'Inter' },
            },
            colors: {
                light: { background: '0 0% 100%' } as any,
                dark: { background: '0 0% 0%' } as any,
            },
        };

        const brand = fromLegacyThemeConfig(legacy);
        expect(brand.layout).toBeUndefined();
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

    it('getThemeOrDefault throws when registry is empty', () => {
        expect(() => getThemeOrDefault('missing')).toThrow(/No theme found for "missing"/);
    });

    it('getThemeByName returns undefined for unregistered name', () => {
        expect(getThemeByName('nope')).toBeUndefined();
    });

    it('clearThemeRegistry empties the registry', () => {
        registerTheme(makeTheme());
        clearThemeRegistry();
        expect(getRegisteredThemeNames()).toEqual([]);
    });

    it('overwrites an existing theme with the same name', () => {
        const v1 = makeTheme({ name: 'brand' });
        const v2 = makeTheme({
            name: 'brand',
            tokens: {
                color: { light: DEFAULT_COLORS_LIGHT, dark: DEFAULT_COLORS_DARK },
                typography: {
                    heading: { fontFamily: 'Roboto' },
                    body: { fontFamily: 'Roboto' },
                    handwriting: { fontFamily: 'Caveat' },
                },
            },
        });
        registerTheme(v1);
        registerTheme(v2);
        expect(getThemeByName('brand')?.tokens.typography.heading.fontFamily).toBe('Roboto');
        expect(getRegisteredThemeNames()).toEqual(['brand']); // still one entry
    });

    it('getThemeOrDefault uses a custom fallback name', () => {
        registerThemes([makeTheme({ name: 'fallback-theme' }), makeTheme({ name: 'other' })]);
        const result = getThemeOrDefault('missing', 'fallback-theme');
        expect(result.name).toBe('fallback-theme');
    });

    it('getThemeOrDefault returns exact match over fallback', () => {
        registerThemes([makeTheme({ name: 'exact' }), makeTheme({ name: 'default' })]);
        const result = getThemeOrDefault('exact');
        expect(result.name).toBe('exact');
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
