import { describe, expect, it } from 'vitest';
import { resolveConfigFromFull } from '../persistence/resolveBrandConfig';
import type { BrandResolutionCache } from '../persistence/types';

const kit = (primary: string, darkPrimary?: string) => ({
    brandName: 'Acme',
    logos: {},
    theme: { colors: { primary, secondary: '#222222' } },
    darkTheme: darkPrimary ? { colors: { primary: darkPrimary } } : undefined,
    defaultColorScheme: 'system',
    allowDarkModeToggle: true,
    hideOttabaseBranding: false,
});

const FULL: BrandResolutionCache = {
    routeMappings: [
        {
            pathPattern: '/**',
            layoutTemplateId: 'app-shell',
            brandKitId: 'default',
            priority: 0,
            tokenOverridesJson: null,
        },
        {
            pathPattern: '/blog/**',
            layoutTemplateId: 'homepage',
            brandKitId: 'blog-kit',
            priority: 10,
            tokenOverridesJson: '{"colors":{"secondary":"#00ff00"}}',
        },
    ],
    layoutTemplatesMap: {},
    menuSlots: {},
    brandKitsMap: {
        default: kit('#111111', '#eeeeee'),
        'blog-kit': kit('#333333'),
    },
} as unknown as BrandResolutionCache;

describe('resolveConfigFromFull', () => {
    it('resolves the kit for the highest-priority matching route', () => {
        const config = resolveConfigFromFull(FULL, '/blog/post-1', 'light');
        expect(config?.layoutTemplateId).toBe('homepage');
        expect((config?.theme as any).colors.primary).toBe('#333333');
    });

    it('applies per-route token overrides on top of the kit theme', () => {
        const config = resolveConfigFromFull(FULL, '/blog/post-1', 'light');
        expect((config?.theme as any).colors.secondary).toBe('#00ff00');
    });

    it('merges darkTheme over the light theme for dark mode', () => {
        const config = resolveConfigFromFull(FULL, '/dashboard', 'dark');
        expect((config?.theme as any).colors.primary).toBe('#eeeeee');
        // Non-overridden tokens fall through from the light theme.
        expect((config?.theme as any).colors.secondary).toBe('#222222');
    });

    it('falls back to the light theme in dark mode when the kit has no darkTheme', () => {
        const config = resolveConfigFromFull(FULL, '/blog/post-1', 'dark');
        expect((config?.theme as any).colors.primary).toBe('#333333');
    });

    it('falls back to the first kit when the matched brandKitId was deleted', () => {
        const withDeletedKit = {
            ...FULL,
            routeMappings: [
                {
                    pathPattern: '/**',
                    layoutTemplateId: 'app-shell',
                    brandKitId: 'gone',
                    priority: 0,
                    tokenOverridesJson: null,
                },
            ],
        } as unknown as BrandResolutionCache;
        const config = resolveConfigFromFull(withDeletedKit, '/anything', 'light');
        expect((config?.theme as any).colors.primary).toBe('#111111');
    });

    it('falls back to the first kit with homepage layout when no route matches', () => {
        const noCatchAll = {
            ...FULL,
            routeMappings: [
                {
                    pathPattern: '/blog/**',
                    layoutTemplateId: 'homepage',
                    brandKitId: 'blog-kit',
                    priority: 10,
                    tokenOverridesJson: null,
                },
            ],
        } as unknown as BrandResolutionCache;
        const config = resolveConfigFromFull(noCatchAll, '/unmapped', 'light');
        expect(config).not.toBeNull();
        expect(config?.layoutTemplateId).toBe('homepage');
    });

    it('returns null only when there are no kits at all', () => {
        const empty = { ...FULL, brandKitsMap: {} } as unknown as BrandResolutionCache;
        expect(resolveConfigFromFull(empty, '/', 'light')).toBeNull();
    });
});
