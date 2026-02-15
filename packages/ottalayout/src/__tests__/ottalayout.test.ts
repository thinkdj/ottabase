import { describe, expect, it } from 'vitest';
import {
    containerPaddingClass,
    contentWidthClass,
    createDefaultRouteMappings,
    DEFAULT_LAYOUT,
    densityPadding,
    isValidLayoutConfig,
    isValidPathPattern,
    LAYOUT_FIELD_DEFAULTS,
    LAYOUT_PRESET_IDS,
    LAYOUT_PRESETS,
    mergeLayoutConfig,
    pathPatternToRegex,
    resolveLayoutForPath,
    resolveRouteForPath,
    sidebarWidthClass,
} from '../index';

// ===========================================================================
// Types & Defaults
// ===========================================================================

describe('DEFAULT_LAYOUT', () => {
    it('has all required fields', () => {
        expect(DEFAULT_LAYOUT.header).toBe('topbar');
        expect(DEFAULT_LAYOUT.navigation).toBe('sidebar');
        expect(DEFAULT_LAYOUT.contentWidth).toBe('lg');
        expect(DEFAULT_LAYOUT.footer).toBe(true);
        expect(DEFAULT_LAYOUT.density).toBe('comfy');
    });

    it('has extended optional fields', () => {
        expect(DEFAULT_LAYOUT.headerSticky).toBe(true);
        expect(DEFAULT_LAYOUT.sidebarWidth).toBe('standard');
        expect(DEFAULT_LAYOUT.sidebarCollapsible).toBe(false);
        expect(DEFAULT_LAYOUT.sidebarPosition).toBe('left');
        expect(DEFAULT_LAYOUT.containerPadding).toBe('md');
        expect(DEFAULT_LAYOUT.centerContent).toBe(false);
    });
});

describe('LAYOUT_FIELD_DEFAULTS', () => {
    it('provides sensible defaults for all optional fields', () => {
        expect(LAYOUT_FIELD_DEFAULTS.headerSticky).toBe(true);
        expect(LAYOUT_FIELD_DEFAULTS.sidebarWidth).toBe('standard');
        expect(LAYOUT_FIELD_DEFAULTS.sidebarCollapsible).toBe(false);
        expect(LAYOUT_FIELD_DEFAULTS.sidebarPosition).toBe('left');
        expect(LAYOUT_FIELD_DEFAULTS.containerPadding).toBe('md');
        expect(LAYOUT_FIELD_DEFAULTS.centerContent).toBe(false);
    });
});

describe('createDefaultRouteMappings', () => {
    it('returns a single catch-all mapping', () => {
        const mappings = createDefaultRouteMappings();
        expect(mappings).toHaveLength(1);
        expect(mappings[0].pathPattern).toBe('/**');
        expect(mappings[0].layoutTemplateId).toBe('app-shell');
        expect(mappings[0].priority).toBe(0);
    });
});

// ===========================================================================
// Presets
// ===========================================================================

describe('LAYOUT_PRESETS', () => {
    it('contains 10 built-in presets', () => {
        expect(LAYOUT_PRESET_IDS).toHaveLength(10);
        expect(Object.keys(LAYOUT_PRESETS)).toHaveLength(10);
    });

    it('includes all expected preset IDs', () => {
        const expected = [
            'homepage',
            'app-shell',
            'docs',
            'minimal',
            'auth',
            'landing',
            'dashboard',
            'settings',
            'marketing',
            'fullscreen',
        ];
        for (const id of expected) {
            expect(LAYOUT_PRESETS[id as keyof typeof LAYOUT_PRESETS]).toBeDefined();
        }
    });

    it('each preset has a valid config', () => {
        for (const [id, preset] of Object.entries(LAYOUT_PRESETS)) {
            expect(isValidLayoutConfig(preset.config)).toBe(true);
        }
    });

    it('auth preset centers content', () => {
        expect(LAYOUT_PRESETS.auth.config.centerContent).toBe(true);
        expect(LAYOUT_PRESETS.auth.config.navigation).toBe('none');
    });

    it('fullscreen preset has no chrome', () => {
        expect(LAYOUT_PRESETS.fullscreen.config.header).toBe('none');
        expect(LAYOUT_PRESETS.fullscreen.config.navigation).toBe('none');
        expect(LAYOUT_PRESETS.fullscreen.config.footer).toBe(false);
    });

    it('dashboard preset has compact density', () => {
        expect(LAYOUT_PRESETS.dashboard.config.density).toBe('compact');
        expect(LAYOUT_PRESETS.dashboard.config.sidebarCollapsible).toBe(true);
    });
});

// ===========================================================================
// Resolver
// ===========================================================================

describe('pathPatternToRegex', () => {
    it('matches exact paths', () => {
        expect(pathPatternToRegex('/about').test('/about')).toBe(true);
        expect(pathPatternToRegex('/about').test('/about/more')).toBe(false);
    });

    it('matches single-segment wildcard *', () => {
        const re = pathPatternToRegex('/user/*');
        expect(re.test('/user/123')).toBe(true);
        expect(re.test('/user/123/profile')).toBe(false);
    });

    it('matches multi-segment wildcard **', () => {
        const re = pathPatternToRegex('/blog/**');
        expect(re.test('/blog')).toBe(true);
        expect(re.test('/blog/post')).toBe(true);
        expect(re.test('/blog/2024/01/my-post')).toBe(true);
    });

    it('escapes regex metacharacters', () => {
        expect(pathPatternToRegex('/foo.bar').test('/foo.bar')).toBe(true);
        expect(pathPatternToRegex('/foo.bar').test('/fooXbar')).toBe(false);
    });
});

describe('resolveLayoutForPath', () => {
    const mappings = [
        { pathPattern: '/blog/**', layoutTemplateId: 'homepage', priority: 10 },
        { pathPattern: '/admin/**', layoutTemplateId: 'app-shell', priority: 10 },
        { pathPattern: '/**', layoutTemplateId: 'app-shell', priority: 0 },
    ];

    it('resolves specific routes before catch-all', () => {
        expect(resolveLayoutForPath('/blog/post', mappings)).toBe('homepage');
        expect(resolveLayoutForPath('/admin/settings', mappings)).toBe('app-shell');
    });

    it('falls back to catch-all', () => {
        expect(resolveLayoutForPath('/random', mappings)).toBe('app-shell');
    });

    it('returns null when no match', () => {
        expect(resolveLayoutForPath('/test', [])).toBeNull();
    });
});

describe('resolveRouteForPath', () => {
    const mappings = [
        { pathPattern: '/blog/**', layoutTemplateId: 'homepage', brandKitId: 'kit-1', priority: 10 },
        { pathPattern: '/**', layoutTemplateId: 'app-shell', brandKitId: 'default', priority: 0 },
    ];

    it('returns full match result', () => {
        const result = resolveRouteForPath('/blog/post', mappings);
        expect(result).toEqual({
            layoutTemplateId: 'homepage',
            brandKitId: 'kit-1',
            tokenOverridesJson: undefined,
        });
    });

    it('includes token overrides when present', () => {
        const withOverrides = [
            {
                pathPattern: '/special',
                layoutTemplateId: 'minimal',
                brandKitId: 'kit-2',
                priority: 5,
                tokenOverridesJson: '{"primary":"red"}',
            },
        ];
        const result = resolveRouteForPath('/special', withOverrides);
        expect(result?.tokenOverridesJson).toBe('{"primary":"red"}');
    });
});

// ===========================================================================
// Validators
// ===========================================================================

describe('mergeLayoutConfig', () => {
    it('returns defaults when partial is null', () => {
        expect(mergeLayoutConfig(null)).toEqual(DEFAULT_LAYOUT);
    });

    it('returns defaults when partial is undefined', () => {
        expect(mergeLayoutConfig(undefined)).toEqual(DEFAULT_LAYOUT);
    });

    it('preserves valid partial values', () => {
        const result = mergeLayoutConfig({ header: 'minimal', density: 'compact' });
        expect(result.header).toBe('minimal');
        expect(result.density).toBe('compact');
        expect(result.navigation).toBe(DEFAULT_LAYOUT.navigation);
    });

    it('defaults invalid header to default', () => {
        const result = mergeLayoutConfig({ header: 'invalid' } as unknown);
        expect(result.header).toBe(DEFAULT_LAYOUT.header);
    });

    it('merges all valid partial fields including new ones', () => {
        const partial = {
            header: 'none' as const,
            navigation: 'drawer' as const,
            contentWidth: 'full' as const,
            footer: false,
            density: 'compact' as const,
            headerSticky: false,
            sidebarWidth: 'narrow' as const,
            centerContent: true,
        };
        const result = mergeLayoutConfig(partial);
        expect(result.header).toBe('none');
        expect(result.navigation).toBe('drawer');
        expect(result.contentWidth).toBe('full');
        expect(result.footer).toBe(false);
        expect(result.headerSticky).toBe(false);
        expect(result.sidebarWidth).toBe('narrow');
        expect(result.centerContent).toBe(true);
    });

    it('accepts fixed and fluid content widths', () => {
        expect(mergeLayoutConfig({ contentWidth: 'fixed' }).contentWidth).toBe('fixed');
        expect(mergeLayoutConfig({ contentWidth: 'fluid' }).contentWidth).toBe('fluid');
    });

    it('accepts new navigation variant "none"', () => {
        expect(mergeLayoutConfig({ navigation: 'none' }).navigation).toBe('none');
    });

    it('accepts new density "spacious"', () => {
        expect(mergeLayoutConfig({ density: 'spacious' }).density).toBe('spacious');
    });

    it('fills optional fields with defaults when not in partial', () => {
        const result = mergeLayoutConfig({ header: 'topbar' });
        expect(result.headerSticky).toBe(LAYOUT_FIELD_DEFAULTS.headerSticky);
        expect(result.sidebarWidth).toBe(LAYOUT_FIELD_DEFAULTS.sidebarWidth);
        expect(result.centerContent).toBe(LAYOUT_FIELD_DEFAULTS.centerContent);
    });
});

describe('isValidLayoutConfig', () => {
    it('accepts full valid config', () => {
        expect(
            isValidLayoutConfig({
                header: 'topbar',
                navigation: 'sidebar',
                contentWidth: 'lg',
                footer: true,
                density: 'comfy',
            }),
        ).toBe(true);
    });

    it('accepts config with fixed/fluid values', () => {
        expect(
            isValidLayoutConfig({
                header: 'topbar',
                navigation: 'sidebar',
                contentWidth: 'fluid',
                footer: true,
                density: 'comfy',
            }),
        ).toBe(true);
    });

    it('accepts config with new values', () => {
        expect(
            isValidLayoutConfig({
                header: 'topbar',
                navigation: 'none',
                contentWidth: 'xs',
                footer: true,
                density: 'spacious',
            }),
        ).toBe(true);
    });

    it('rejects invalid header', () => {
        expect(isValidLayoutConfig({ ...DEFAULT_LAYOUT, header: 'invalid' })).toBe(false);
    });

    it('rejects missing footer', () => {
        expect(isValidLayoutConfig({ ...DEFAULT_LAYOUT, footer: undefined })).toBe(false);
    });

    it('rejects non-object', () => {
        expect(isValidLayoutConfig(null)).toBe(false);
        expect(isValidLayoutConfig('string')).toBe(false);
    });
});

describe('isValidPathPattern', () => {
    it('accepts simple paths', () => {
        expect(isValidPathPattern('/')).toBe(true);
        expect(isValidPathPattern('/about')).toBe(true);
    });

    it('accepts wildcard patterns', () => {
        expect(isValidPathPattern('/*')).toBe(true);
        expect(isValidPathPattern('/docs/**')).toBe(true);
    });

    it('rejects empty string', () => {
        expect(isValidPathPattern('')).toBe(false);
    });

    it('rejects non-string', () => {
        expect(isValidPathPattern(null as unknown as string)).toBe(false);
    });
});

// ===========================================================================
// CSS Utilities
// ===========================================================================

describe('contentWidthClass', () => {
    it('maps named sizes to Tailwind classes', () => {
        expect(contentWidthClass('xs')).toBe('max-w-xl');
        expect(contentWidthClass('sm')).toBe('max-w-3xl');
        expect(contentWidthClass('md')).toBe('max-w-5xl');
        expect(contentWidthClass('lg')).toBe('max-w-7xl');
        expect(contentWidthClass('xl')).toBe('max-w-[1536px]');
        expect(contentWidthClass('full')).toBe('w-full');
    });

    it('maps fixed and fluid to classes', () => {
        expect(contentWidthClass('fixed')).toBe('max-w-5xl');
        expect(contentWidthClass('fluid')).toBe('max-w-7xl');
    });
});

describe('densityPadding', () => {
    it('maps density to padding classes', () => {
        expect(densityPadding('compact')).toBe('py-4');
        expect(densityPadding('comfy')).toBe('py-10');
        expect(densityPadding('spacious')).toBe('py-16');
    });
});

describe('sidebarWidthClass', () => {
    it('maps sidebar width to Tailwind classes', () => {
        expect(sidebarWidthClass('narrow')).toBe('w-48');
        expect(sidebarWidthClass('standard')).toBe('w-64');
        expect(sidebarWidthClass('wide')).toBe('w-80');
    });

    it('defaults to standard', () => {
        expect(sidebarWidthClass()).toBe('w-64');
    });
});

describe('containerPaddingClass', () => {
    it('maps padding to Tailwind classes', () => {
        expect(containerPaddingClass('none')).toBe('px-0');
        expect(containerPaddingClass('sm')).toBe('px-2');
        expect(containerPaddingClass('md')).toBe('px-4');
        expect(containerPaddingClass('lg')).toBe('px-8');
    });

    it('defaults to md', () => {
        expect(containerPaddingClass()).toBe('px-4');
    });
});
