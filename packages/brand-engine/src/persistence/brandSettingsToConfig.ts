// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandSettings to ResolvedBrandConfig
// Used by API handlers for GET /api/brand
// ---------------------------------------------------------------------------

import type { BrandSettings } from './BrandSettings.model';
import type { ResolvedBrandConfig } from './types';
import type { LayoutData } from './layoutData';
import type { DesignTokens } from '../tokens';
import type { LayoutConfig } from '../layout';
import { DEFAULT_BRAND_THEME } from '../defaults';
import { resolveTheme, deepMerge } from '../resolver';
import { LAYOUT_PRESETS } from '../layouts/presets';

/** Default route mappings when preset has none */
const DEFAULT_ROUTE_MAPPINGS = [
    { pathPattern: '/demo/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/admin/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/dashboard', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/profile', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/shortlinks', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/referrals', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/blog/**', layoutTemplateId: 'homepage', priority: 10 },
    { pathPattern: '/organizations/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/*', layoutTemplateId: 'homepage', priority: 0 },
];

/**
 * Convert BrandSettings to API/cache response shape.
 * Presets (name!=null) use routeMappingsJson/layoutTemplatesSnapshotJson when set.
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
    const routeMappingsFromPreset = settings.getRouteMappings();
    const snapshotFromPreset = settings.getLayoutTemplatesSnapshot();
    const usePresetLayout = routeMappingsFromPreset.length > 0 || Object.keys(snapshotFromPreset).length > 0;

    const routeMappings = usePresetLayout
        ? routeMappingsFromPreset.map((m) => ({
              pathPattern: m.pathPattern,
              layoutTemplateId: m.layoutTemplateId,
              priority: m.priority ?? 0,
          }))
        : (layoutData?.routeMappings ?? DEFAULT_ROUTE_MAPPINGS);

    // Merge presets base with snapshot or layoutData
    let layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }> = {};
    for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
        layoutTemplatesMap[key] = { componentKey: preset.componentKey, config: preset.config };
    }
    if (Object.keys(snapshotFromPreset).length > 0) {
        Object.assign(layoutTemplatesMap, snapshotFromPreset);
    } else if (layoutData?.layoutTemplatesMap) {
        Object.assign(layoutTemplatesMap, layoutData.layoutTemplatesMap);
    }

    return {
        brandName: (settings.get('brandName') as string) || (settings.get('name') as string) || 'My App',
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
        routeMappings,
        layoutTemplatesMap,
    };
}
