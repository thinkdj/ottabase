// Server-side brand configuration generator for Next.js SSR
// This generates the brand config that would normally come from /api/brand

import { DEFAULT_LAYOUT, getThemeByName, registerBuiltInThemes, resolveTheme } from '@ottabase/brand-engine';
import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { brandConfig, themePreset } from '../config/brand.config';

// Register themes on server startup
registerBuiltInThemes();

/**
 * Generate brand configuration for SSR
 * This replaces the need for a /api/brand endpoint
 */
export function generateBrandConfig(mode: 'light' | 'dark' = 'light'): FullBrandConfig {
    // Get the theme preset
    const baseTheme = getThemeByName(themePreset) || getThemeByName('default')!;

    // Resolve the theme with tenant overrides
    const resolvedTheme = resolveTheme({
        base: baseTheme,
        tenantOverrides: brandConfig,
        mode,
    });

    // Build the full config structure expected by BrandProvider
    const config: FullBrandConfig = {
        mode,
        kit: 'default',
        routes: [
            ['/', 'homepage', 100],
            ['/about', 'homepage', 100],
            ['/*', 'homepage', 0], // Catch-all
        ],
        layoutTemplatesMap: {
            homepage: {
                componentKey: 'homepage',
                config: DEFAULT_LAYOUT,
            },
        },
        brandKitsMap: {
            default: {
                brandName: brandConfig.name || 'Ottabase',
                tagline: undefined,
                logos: {},
                theme: resolvedTheme,
                themeBase: themePreset,
                tenantTheme: brandConfig,
                defaultColorScheme: 'system',
                allowDarkModeToggle: true,
                customCss: undefined,
                hideOttabaseBranding: false,
            },
        },
    };

    return config;
}
