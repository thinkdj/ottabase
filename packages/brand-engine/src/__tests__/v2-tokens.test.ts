// ---------------------------------------------------------------------------
// Brand Engine v2 – token category tests
// Covers: sparse category resolution, palette collision guarding, radius
// scale, open motion vocabulary, dark-delta policy, aliases in the kit path,
// scope CSS, effects CSS generation, and the critical/effects style tags.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { buildCriticalCSSDual, buildCustomCssStyleTag, buildEffectsStyleTag } from '../css-critical';
import { applyBrandTheme, buildBrandStylesheet, buildCSSVarMap } from '../css-runtime';
import { buildEffectsCSS, buildScopesCSS } from '../effects';
import { EFFECT_REGISTRY, KEYFRAME_REGISTRY } from '../effects/registry';
import { buildPreviewTheme } from '../previewTheme';
import { darkSplitCategories, isModeSplit, pickMode, resolveTokenSet } from '../resolve-core';
import type { ResolvedBrandTheme } from '../resolver';
import { resolveTheme } from '../resolver';
import type { BrandTheme } from '../theme';
import type { DesignTokens } from '../tokens';
import { TOKEN_CATEGORY_KEYS, isReservedVarName } from '../tokens';

/** Minimal resolved theme for emission tests */
function makeTheme(tokens: Partial<DesignTokens>): ResolvedBrandTheme {
    return resolveTheme({
        base: { name: 'test', tokens: { color: {} as DesignTokens['color'], ...tokens } } as BrandTheme,
    });
}

describe('isModeSplit / pickMode', () => {
    it('treats objects with light/dark keys as splits', () => {
        expect(isModeSplit({ light: {}, dark: {} })).toBe(true);
        expect(isModeSplit({ dark: {} })).toBe(true);
        expect(isModeSplit({ section: '2rem' })).toBe(false);
    });

    it('does NOT misclassify motion with disableAnimations as a split (pre-v2 bug)', () => {
        const motion = { durationFast: '50ms', disableAnimations: true };
        expect(isModeSplit(motion)).toBe(false);
        expect(pickMode(motion, 'light')).toEqual(motion);
    });

    it('picks the dark value with light fallback', () => {
        expect(pickMode({ light: 'a', dark: 'b' }, 'dark')).toBe('b');
        expect(pickMode({ light: 'a' }, 'dark')).toBe('a');
        expect(pickMode('flat', 'dark')).toBe('flat');
    });
});

describe('motion vocabulary', () => {
    it('honours disableAnimations from a flat motion object (regression)', () => {
        const theme = makeTheme({ motion: { disableAnimations: true } });
        const vars = buildCSSVarMap(theme);
        expect(vars['--duration-fast']).toBe('0s');
        expect(vars['--duration-normal']).toBe('0s');
    });

    it('emits named durations/easings and the spring', () => {
        const theme = makeTheme({
            motion: {
                easingSpring: 'cubic-bezier(.34,1.4,.5,1)',
                durations: { press: '120ms' },
                easings: { settle: 'ease-out' },
            },
        });
        const vars = buildCSSVarMap(theme);
        expect(vars['--ease-spring']).toBe('cubic-bezier(.34,1.4,.5,1)');
        expect(vars['--motion-ease-bouncy']).toBe('cubic-bezier(.34,1.4,.5,1)');
        expect(vars['--duration-press']).toBe('120ms');
        expect(vars['--ease-settle']).toBe('ease-out');
    });

    it('zeroes named durations when animations are disabled', () => {
        const theme = makeTheme({ motion: { disableAnimations: true, durations: { press: '120ms' } } });
        expect(buildCSSVarMap(theme)['--duration-press']).toBe('0s');
    });
});

describe('palette (raw/derived colors)', () => {
    it('emits palette values verbatim', () => {
        const theme = makeTheme({
            palette: { 'upp-glow': 'color-mix(in srgb, hsl(var(--primary)) 36%, transparent)', link: '#2323E8' },
        });
        const vars = buildCSSVarMap(theme);
        expect(vars['--upp-glow']).toBe('color-mix(in srgb, hsl(var(--primary)) 36%, transparent)');
        expect(vars['--link']).toBe('#2323E8');
    });

    it('drops palette keys that shadow engine vars or semantic colors', () => {
        const theme = makeTheme({
            palette: { primary: '#f00', 'shadow-md': '0 0 0', 'link-lift': '#88f', safe: '#0f0' },
        });
        expect(theme.palette).toEqual({ 'link-lift': '#88f', safe: '#0f0' });
    });

    it('reserves exact link contract names but not the link- prefix', () => {
        expect(isReservedVarName('link-color')).toBe(true);
        expect(isReservedVarName('link-visited')).toBe(true);
        expect(isReservedVarName('link-lift')).toBe(false);
        expect(isReservedVarName('link')).toBe(false);
    });

    it('supports mode-split palettes', () => {
        const tokens: Partial<DesignTokens> = {
            palette: { light: { wash: '#eee' }, dark: { wash: '#222' } },
        };
        expect(resolveTokenSet(tokens, 'light').palette).toEqual({ wash: '#eee' });
        expect(resolveTokenSet(tokens, 'dark').palette).toEqual({ wash: '#222' });
    });
});

describe('typography roles', () => {
    it('always emits the four default roles', () => {
        const vars = buildCSSVarMap(makeTheme({}));
        expect(vars['--font-heading']).toContain('Sora');
        expect(vars['--font-body']).toContain('Source Sans 3');
        expect(vars['--font-mono']).toContain('JetBrains Mono');
        expect(vars['--font-handwriting']).toContain('cursive');
    });

    it('emits custom roles and per-role extended props', () => {
        const theme = makeTheme({
            typography: {
                ticker: { fontFamily: 'Archivo', fontWeight: 600, textTransform: 'uppercase' },
            },
        });
        const vars = buildCSSVarMap(theme);
        expect(vars['--font-ticker']).toBe('"Archivo", sans-serif');
        expect(vars['--typography-ticker-weight']).toBe('600');
        expect(vars['--typography-ticker-transform']).toBe('uppercase');
    });

    it('keeps historical heading/body defaults', () => {
        const vars = buildCSSVarMap(makeTheme({}));
        expect(vars['--typography-heading-weight']).toBe('700');
        expect(vars['--typography-heading-line-height']).toBe('1.2');
        expect(vars['--typography-body-weight']).toBe('400');
        expect(vars['--typography-body-line-height']).toBe('1.5');
    });
});

describe('type scale', () => {
    it('emits size + paired metrics per step', () => {
        const theme = makeTheme({
            typeScale: {
                sm: { size: '14px', lineHeight: '1.55' },
                base: '16px',
                display: { size: 'clamp(56px, 9vw, 96px)', letterSpacing: '-0.02em', fontWeight: 'bold' },
            },
        });
        const vars = buildCSSVarMap(theme);
        expect(vars['--text-sm']).toBe('14px');
        expect(vars['--text-sm-lh']).toBe('1.55');
        expect(vars['--text-base']).toBe('16px');
        expect(vars['--text-display']).toBe('clamp(56px, 9vw, 96px)');
        expect(vars['--text-display-ls']).toBe('-0.02em');
        expect(vars['--text-display-weight']).toBe('700');
    });

    it('is sparse — no --text-* vars without a typeScale', () => {
        const vars = buildCSSVarMap(makeTheme({}));
        expect(Object.keys(vars).some((k) => k.startsWith('--text-'))).toBe(false);
    });
});

describe('radius scale', () => {
    it('keeps scalar radius behaviour', () => {
        const theme = makeTheme({ radius: '1rem' });
        expect(theme.radius).toBe('1rem');
        expect(theme.radiusScale).toBeUndefined();
    });

    it('resolves a per-size record with base feeding the scalar', () => {
        const theme = makeTheme({ radius: { base: '4px', md: '3px', full: '2px' } });
        expect(theme.radius).toBe('4px');
        expect(theme.radiusScale).toEqual({ md: '3px', full: '2px' });
        const vars = buildCSSVarMap(theme);
        expect(vars['--radius']).toBe('4px');
        expect(vars['--radius-md']).toBe('3px');
        expect(vars['--radius-full']).toBe('2px');
    });

    it('falls back to lg for the scalar when base is absent', () => {
        const theme = makeTheme({ radius: { lg: '8px', full: '9999px' } });
        expect(theme.radius).toBe('8px');
        expect(theme.radiusScale).toEqual({ lg: '8px', full: '9999px' });
    });
});

describe('sparse chrome categories', () => {
    it('emits border / focus / interaction / links / selection / scrollbar / native / z-index / surface vars', () => {
        const theme = makeTheme({
            border: { width: '2px', widthStrong: '3px', style: 'solid' },
            focus: { width: '2px', style: 'dotted', color: 'var(--link)', offset: '2px' },
            interaction: {
                hoverTransform: 'translateY(-1px)',
                activeTransform: 'scale(0.97)',
                activeDuration: '120ms',
                easing: 'var(--ease-spring)',
            },
            links: { color: '#2323E8', visitedColor: '#551A8B', underline: true },
            selection: { background: 'hsl(var(--primary))', foreground: 'white' },
            scrollbar: { width: 'thin', thumb: 'hsl(var(--border))' },
            native: { accentColor: 'hsl(var(--primary))', caretColor: '#2323E8' },
            zIndex: { modal: 50, toast: 100 },
            surface: { backdrop: 'radial-gradient(circle, #000, #111)' },
        });
        const vars = buildCSSVarMap(theme);
        expect(vars['--border-width']).toBe('2px');
        expect(vars['--border-width-strong']).toBe('3px');
        expect(vars['--focus-ring-style']).toBe('dotted');
        expect(vars['--hover-transform']).toBe('translateY(-1px)');
        expect(vars['--press-transform']).toBe('scale(0.97)');
        expect(vars['--press-duration']).toBe('120ms');
        expect(vars['--press-ease']).toBe('var(--ease-spring)');
        expect(vars['--link-color']).toBe('#2323E8');
        expect(vars['--link-visited']).toBe('#551A8B');
        expect(vars['--link-underline']).toBe('underline');
        expect(vars['--selection-bg']).toBe('hsl(var(--primary))');
        expect(vars['--scrollbar-width']).toBe('thin');
        expect(vars['--accent-color']).toBe('hsl(var(--primary))');
        expect(vars['--z-modal']).toBe('50');
        expect(vars['--z-toast']).toBe('100');
        expect(vars['--bg-backdrop']).toBe('radial-gradient(circle, #000, #111)');
    });

    it('emits nothing for undefined sparse categories (zero-config = zero new vars)', () => {
        const vars = buildCSSVarMap(makeTheme({}));
        const sparse = ['--border-width', '--focus-ring-width', '--hover-transform', '--link-color', '--z-'];
        for (const prefix of sparse) {
            expect(Object.keys(vars).some((k) => k.startsWith(prefix))).toBe(false);
        }
    });

    it('resolves native color-scheme auto per mode', () => {
        const theme = makeTheme({ native: { colorScheme: 'auto' } });
        expect(buildCSSVarMap(theme, 'light')['color-scheme']).toBe('light');
        expect(buildCSSVarMap(theme, 'dark')['color-scheme']).toBe('dark');
    });
});

describe('overlay color token', () => {
    it('defaults overlay to black channels in both palettes', () => {
        const vars = buildCSSVarMap(makeTheme({}));
        expect(vars['--overlay']).toBe('0 0% 0%');
    });
});

describe('scopes (token rooms)', () => {
    it('emits a flat scope as a single mode-independent block', () => {
        const css = buildScopesCSS({
            afterdark: {
                color: { background: '222 10% 6%', foreground: '0 0% 95%' },
                palette: { glow: '#ededf0' },
            },
        });
        expect(css).toContain('[data-brand-scope="afterdark"]');
        expect(css).toContain('--background: 222 10% 6%;');
        expect(css).toContain('--glow: #ededf0;');
        expect(css).not.toContain('.dark [data-brand-scope');
    });

    it('emits a dark block when a category is mode-split', () => {
        const css = buildScopesCSS({
            screen: { color: { light: { card: '0 0% 100%' }, dark: { card: '240 6% 10%' } } },
        });
        expect(css).toContain('[data-brand-scope="screen"]');
        expect(css).toContain('.dark [data-brand-scope="screen"]');
        expect(css).toContain('--card: 240 6% 10%;');
    });

    it('skips invalid scope names', () => {
        const css = buildScopesCSS({ 'bad name!{}': { color: { background: '0 0% 0%' } } });
        expect(css).toBe('');
    });

    it('rides the critical CSS', () => {
        const theme = makeTheme({ scopes: { room: { color: { background: '0 0% 7%' } } } });
        const css = buildBrandStylesheet(theme);
        expect(css).toContain(':root {');
        expect(css).toContain('[data-brand-scope="room"]');
    });
});

describe('effects stylesheet', () => {
    it('returns empty for a zero-config theme', () => {
        expect(buildEffectsCSS(makeTheme({}))).toBe('');
        expect(buildEffectsStyleTag(makeTheme({}))).toBe('');
    });

    it('generates @font-face rules', () => {
        const theme = makeTheme({
            fontFaces: [{ family: 'Archivo', src: "url(/fonts/archivo.woff2) format('woff2')", weight: '100 900' }],
        });
        const css = buildEffectsCSS(theme);
        expect(css).toContain('@font-face');
        expect(css).toContain('font-family: "Archivo";');
        expect(css).toContain('font-weight: 100 900;');
        expect(css).toContain('font-display: swap;');
    });

    it('generates @keyframes from raw bodies and the registry', () => {
        const theme = makeTheme({
            motion: {
                keyframes: {
                    fadein: '0% { opacity: 0; } 100% { opacity: 1; }',
                    blink: 'registry:blink',
                    missing: 'registry:not-a-thing',
                },
            },
        });
        const css = buildEffectsCSS(theme);
        expect(css).toContain('@keyframes fadein');
        expect(css).toContain('@keyframes blink');
        expect(css).toContain(KEYFRAME_REGISTRY['blink']);
        expect(css).not.toContain('missing');
    });

    it('generates .ts-{name} text-style voices', () => {
        const theme = makeTheme({
            textStyles: {
                kicker: {
                    fontRole: 'mono',
                    size: '11px',
                    fontWeight: 'bold',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                },
            },
        });
        const css = buildEffectsCSS(theme);
        expect(css).toContain('.ts-kicker {');
        expect(css).toContain('font-family: var(--font-mono);');
        expect(css).toContain('font-weight: 700;');
        expect(css).toContain('text-transform: uppercase;');
    });

    it('generates the link contract only when links tokens exist', () => {
        expect(buildEffectsCSS(makeTheme({}))).not.toContain(':visited');
        const css = buildEffectsCSS(
            makeTheme({ links: { color: '#2323E8', visitedColor: '#551A8B', underline: true } }),
        );
        expect(css).toContain('a:where(:not([class]))');
        expect(css).toContain('color: var(--link-color);');
        expect(css).toContain('text-decoration-line: var(--link-underline);');
        expect(css).toContain(':visited');
    });

    it('generates registry-backed effect utilities', () => {
        const theme = makeTheme({
            effects: { utilities: { 'fx-scanlines': 'registry:scanlines', 'fx-custom': 'opacity: 0.9;' } },
        });
        const css = buildEffectsCSS(theme);
        expect(css).toContain('.fx-scanlines {');
        expect(css).toContain(EFFECT_REGISTRY['scanlines']);
        expect(css).toContain('.fx-custom {');
    });

    it('neutralizes rule-breakout attempts in generated declarations', () => {
        const theme = makeTheme({
            effects: { utilities: { evil: 'color: red; } body { display: none; ' } },
        });
        const css = buildEffectsCSS(theme);
        expect(css).not.toContain('} body {');
    });
});

describe('dark delta policy (split-only for new categories)', () => {
    it('reports only explicitly dark-split categories', () => {
        const tokens: Partial<DesignTokens> = {
            palette: { light: { a: '#fff' }, dark: { a: '#000' } },
            typeScale: { sm: '14px' },
            border: { width: '2px' },
        };
        const split = darkSplitCategories(tokens);
        expect(split.has('palette')).toBe(true);
        expect(split.has('typeScale')).toBe(false);
        expect(split.has('border')).toBe(false);
    });
});

describe('aliases in the resolution core', () => {
    it('creates alias color entries (now active in every pipeline)', () => {
        const set = resolveTokenSet({ color: {} as DesignTokens['color'], aliases: { brand: 'primary' } }, 'light');
        expect(set.colors['brand']).toBe(set.colors.primary);
    });
});

describe('preset passthrough', () => {
    it('TOKEN_CATEGORY_KEYS covers every DesignTokens category', () => {
        // Compile-time satisfies clause guarantees membership; runtime sanity:
        expect(TOKEN_CATEGORY_KEYS).toContain('palette');
        expect(TOKEN_CATEGORY_KEYS).toContain('scopes');
        expect(TOKEN_CATEGORY_KEYS).toContain('effects');
    });

    it('buildPreviewTheme resolves v2 categories', () => {
        const theme = buildPreviewTheme({
            tokensJson: JSON.stringify({
                palette: { link: '#2323E8' },
                typeScale: { sm: '14px' },
                focus: { style: 'dotted' },
            }),
        });
        expect(theme.palette).toEqual({ link: '#2323E8' });
        expect(theme.typeScale).toEqual({ sm: '14px' });
        expect(theme.focus).toEqual({ style: 'dotted' });
    });
});

describe('critical + custom css tags', () => {
    it('dual critical CSS carries scope blocks and both palettes', () => {
        const light = makeTheme({ scopes: { room: { color: { background: '0 0% 7%' } } } });
        const dark = makeTheme({});
        const css = buildCriticalCSSDual(light, dark);
        expect(css).toContain(':root {');
        expect(css).toContain('.dark {');
        expect(css).toContain('[data-brand-scope="room"]');
    });

    it('buildCustomCssStyleTag wraps non-empty css and skips empty', () => {
        expect(buildCustomCssStyleTag('.a { color: red; }')).toBe(
            '<style id="brand-custom-css">.a { color: red; }</style>',
        );
        expect(buildCustomCssStyleTag('   ')).toBe('');
        expect(buildCustomCssStyleTag(null)).toBe('');
    });
});

describe('applyBrandTheme (stylesheet-based)', () => {
    it('is a safe no-op outside the DOM', () => {
        expect(() => applyBrandTheme(makeTheme({}))).not.toThrow();
    });
});

describe('visited preset (the90s.page "Visited" design system port, end-to-end)', () => {
    it('registers and resolves through the registry path', async () => {
        const { PRESET_MAP } = await import('../presets');
        const { fromLegacyThemeConfig } = await import('../adapter');
        const brandTheme = fromLegacyThemeConfig(PRESET_MAP['visited'] as never);
        const resolved = resolveTheme({ base: brandTheme });

        // One-radius law: 2px everywhere, pills banned (full = 2px)
        expect(resolved.radius).toBe('2px');
        expect(resolved.radiusScale?.full).toBe('2px');
        // Flatness charter: every shadow slot resolves to none
        for (const level of ['xs', 'sm', 'md', 'lg', 'xl']) {
            expect(resolved.shadows[level]).toBe('none');
        }
        // One-knob derivation: ramp derives from --link via color-mix
        expect(resolved.palette?.['link']).toBe('#2323E8');
        expect(resolved.palette?.['link-lift']).toContain('color-mix');
        // Pinned Netscape triad
        expect(resolved.palette?.['been']).toBe('#551A8B');
        expect(resolved.links?.visitedColor).toBe('var(--been)');

        const vars = buildCSSVarMap(resolved);
        expect(vars['--text-base']).toBe('16px');
        expect(vars['--text-base-lh']).toBe('1.65');
        expect(vars['--font-mono']).toContain('Courier Prime');
        expect(vars['--font-label']).toContain('Verdana');
        expect(vars['--focus-ring-style']).toBe('dotted');
        expect(vars['--press-transform']).toBe('translateY(1px)');
        expect(vars['--duration-linger']).toBe('3000ms');

        // After Dark room + bespoke recipes ride the generated CSS
        const critical = buildBrandStylesheet(resolved);
        expect(critical).toContain('[data-brand-scope="afterdark"]');
        const effects = buildEffectsCSS(resolved);
        expect(effects).toContain('.ts-kicker');
        expect(effects).toContain(':visited');
        expect(effects).toContain('.membrane:active');
        expect(effects).toContain('.groove');
    });

    it('survives preset expansion via TOKEN_CATEGORY_KEYS (admin save path)', async () => {
        const { PRESET_MAP } = await import('../presets');
        // Mirror expandPresetToTokens passthrough: every category present in the
        // preset must be whitelisted, or the admin save silently drops it.
        const RENAMED: Record<string, string> = { colors: 'color', shadows: 'shadow' };
        for (const name of ['visited', 'marquee']) {
            const preset = PRESET_MAP[name] as unknown as Record<string, unknown>;
            for (const key of Object.keys(preset)) {
                if (key === 'name' || key === 'cursors' || key === 'layout') continue;
                const canonical = RENAMED[key] ?? key;
                expect(TOKEN_CATEGORY_KEYS, `category "${canonical}" missing from TOKEN_CATEGORY_KEYS`).toContain(
                    canonical,
                );
            }
        }
    });
});

describe('marquee preset (uppcoming "Marquee" design system port, end-to-end)', () => {
    it('registers and resolves through the registry path', async () => {
        const { PRESET_MAP } = await import('../presets');
        const { fromLegacyThemeConfig } = await import('../adapter');
        const brandTheme = fromLegacyThemeConfig(PRESET_MAP['marquee'] as never);
        const resolved = resolveTheme({ base: brandTheme });

        // One pigment, six live derivatives (soft/wash re-derive per room/mode)
        expect(resolved.palette?.['upp']).toBe('#D82042');
        for (const d of ['upp-hot', 'upp-deep', 'upp-lift', 'upp-soft', 'upp-wash', 'upp-glow']) {
            expect(resolved.palette?.[d], d).toContain('color-mix');
        }
        // Size-stepped radius ladder; faces stay round
        expect(resolved.radius).toBe('8px');
        expect(resolved.radiusScale?.['2xl']).toBe('16px');
        expect(resolved.radiusScale?.full).toBe('9999px');
        // Spring press physics
        expect(resolved.interaction?.hoverTransform).toBe('translateY(-1px)');
        expect(resolved.interaction?.activeTransform).toBe('scale(0.97)');
        expect(resolved.motion.easingSpring).toBe('cubic-bezier(0.34, 1.4, 0.5, 1)');

        const vars = buildCSSVarMap(resolved);
        expect(vars['--font-ticker']).toContain('Spline Sans Mono');
        expect(vars['--shadow-glow']).toBe('0 0 0 3px var(--upp-glow)');
        expect(vars['--duration-press-med']).toBe('200ms');

        // The screen room + ticket-stub signatures ride the generated CSS
        const critical = buildBrandStylesheet(resolved);
        expect(critical).toContain('[data-brand-scope="screen"]');
        const effects = buildEffectsCSS(resolved);
        expect(effects).toContain('.notch');
        expect(effects).toContain('clip-path: polygon(16px 0');
        expect(effects).toContain('.perf');
        expect(effects).toContain('@keyframes shimmer');
        expect(effects).toContain('@keyframes dotpulse');
        expect(effects).toContain('.ts-stretch-wide');
        expect(effects).toContain('font-stretch: 114%;');
        // dark palette split re-derives soft/wash against the dark base
        const darkResolved = resolveTheme({ base: brandTheme, mode: 'dark' });
        expect(darkResolved.palette?.['upp-wash']).toContain('#101013');
    });
});
