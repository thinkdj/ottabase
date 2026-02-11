// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandSettings to ResolvedBrandConfig
// Used by API handlers for GET /api/brand
// ---------------------------------------------------------------------------

import type { BrandSettings } from './BrandSettings.model';
import type { ResolvedBrandConfig } from './types';
import type { LayoutData } from './layoutData';
import type { DesignTokens } from '../tokens';
import { DEFAULT_BRAND_THEME } from '../defaults';
import { resolveTheme, deepMerge } from '../resolver';

/**
 * Convert BrandSettings to API/cache response shape.
 * Uses default theme as base, merges settings.toBrandTheme() overrides.
 * Optionally merges themeVariantTokens (from ThemeVariant) over tenant tokens.
 * Optionally merges layout data (routeMappings, layoutTemplatesMap).
 */
export function brandSettingsToConfig(
    settings: BrandSettings,
    r2PublicUrl: string,
    mode: 'light' | 'dark' = 'light',
    layoutData?: LayoutData,
    themeVariantTokens?: Partial<DesignTokens>,
): ResolvedBrandConfig {
    let tenantTheme = settings.toBrandTheme();
    if (themeVariantTokens && Object.keys(themeVariantTokens).length > 0) {
        const mergedTokens = deepMerge(
            (tenantTheme.tokens || {}) as unknown as Record<string, unknown>,
            themeVariantTokens as unknown as Record<string, unknown>,
        ) as unknown as DesignTokens;
        tenantTheme = { ...tenantTheme, tokens: mergedTokens };
    }
    const theme = resolveTheme({
        base: DEFAULT_BRAND_THEME,
        tenantOverrides: tenantTheme,
        mode,
    });

    const logos = settings.getLogoUrls(r2PublicUrl);

    return {
        brandName: (settings.get('brandName') as string) || 'My App',
        tagline: (settings.get('tagline') as string) || undefined,
        logos: {
            primary: logos.logo,
            dark: logos.logoDark,
            icon: logos.icon,
            ogImage: logos.ogImage,
            emailLogo: logos.emailLogo,
        },
        theme,
        defaultColorScheme: (settings.get('defaultColorScheme') as 'light' | 'dark' | 'system') || 'system',
        allowDarkModeToggle: (settings.get('allowDarkModeToggle') as boolean) ?? true,
        customCss: (settings.get('customCss') as string) || undefined,
        hideOttabaseBranding: (settings.get('hideOttabaseBranding') as boolean) ?? false,
        routeMappings: layoutData?.routeMappings ?? [],
        layoutTemplatesMap: layoutData?.layoutTemplatesMap ?? {},
    };
}
