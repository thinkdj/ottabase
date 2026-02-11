// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandBox to ResolvedBrandConfig
// Used when BrandBox is active or in preview mode
// ---------------------------------------------------------------------------

import type { BrandBox } from './BrandBox.model';
import type { ResolvedBrandConfig } from './types';
import type { LayoutConfig } from '../layout';
import { DEFAULT_BRAND_THEME } from '../defaults';
import { resolveTheme, deepMerge } from '../resolver';
import { LayoutTemplate } from './LayoutTemplate.model';
import { ThemeVariant } from './ThemeVariant.model';
import { LAYOUT_PRESETS } from '../layouts/presets';

/** Default route mappings when box has none */
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

async function resolveLayoutTemplatesMap(
    box: BrandBox,
): Promise<Record<string, { componentKey: string; config: LayoutConfig }>> {
    const snapshot = box.getLayoutTemplatesSnapshot();
    if (Object.keys(snapshot).length > 0) return snapshot;

    const routeMappings = box.getRouteMappings();
    const templateIds =
        routeMappings.length > 0
            ? [...new Set(routeMappings.map((m) => m.layoutTemplateId))]
            : [...new Set(DEFAULT_ROUTE_MAPPINGS.map((m) => m.layoutTemplateId))];

    const map: Record<string, { componentKey: string; config: LayoutConfig }> = {};
    for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
        map[key] = { componentKey: preset.componentKey, config: preset.config };
    }
    for (const id of templateIds) {
        const template = (await LayoutTemplate.find(id)) as InstanceType<typeof LayoutTemplate> | null;
        if (template) {
            map[id] = {
                componentKey: template.get('componentKey') as string,
                config: template.getConfig(),
            };
        }
    }
    return map;
}

/**
 * Convert BrandBox to ResolvedBrandConfig.
 * Uses themeVariantId if set to merge theme variant tokens.
 */
export async function brandBoxToConfig(
    box: BrandBox,
    r2PublicUrl: string,
    mode: 'light' | 'dark' = 'light',
): Promise<ResolvedBrandConfig> {
    const identity = box.getIdentity();
    const logosRaw = box.getLogos();
    const baseUrl = r2PublicUrl || '';

    const logos = {
        primary: logosRaw.logoKey ? `${baseUrl}/${logosRaw.logoKey}` : undefined,
        dark: logosRaw.logoDarkKey ? `${baseUrl}/${logosRaw.logoDarkKey}` : undefined,
        icon: logosRaw.iconKey ? `${baseUrl}/${logosRaw.iconKey}` : undefined,
        ogImage: logosRaw.ogImageKey ? `${baseUrl}/${logosRaw.ogImageKey}` : undefined,
        emailLogo: logosRaw.emailLogoKey ? `${baseUrl}/${logosRaw.emailLogoKey}` : undefined,
    };

    let tokens: Record<string, unknown> = {};
    const tokensJson = box.get('tokensJson');
    if (tokensJson && typeof tokensJson === 'string') {
        try {
            tokens = JSON.parse(tokensJson) as Record<string, unknown>;
        } catch {
            // ignore
        }
    }

    // Merge theme variant tokens if set
    const themeVariantId = box.get('themeVariantId') as string | null;
    if (themeVariantId) {
        const variant = (await ThemeVariant.find(themeVariantId)) as InstanceType<typeof ThemeVariant> | null;
        if (variant) {
            const variantTokens = variant.getTokens() as Record<string, unknown>;
            tokens = deepMerge(tokens, variantTokens);
        }
    }

    const tenantTheme = {
        name: `brandbox-${box.get('id')}`,
        tokens: tokens as typeof DEFAULT_BRAND_THEME.tokens,
    };
    const theme = resolveTheme({
        base: DEFAULT_BRAND_THEME,
        tenantOverrides: tenantTheme,
        mode,
    });

    const routeMappings = box.getRouteMappings().length > 0 ? box.getRouteMappings() : DEFAULT_ROUTE_MAPPINGS;
    const layoutTemplatesMap = await resolveLayoutTemplatesMap(box);

    return {
        brandName: identity.brandName || (box.get('name') as string) || 'My App',
        tagline: identity.tagline,
        logos,
        theme,
        defaultColorScheme: 'system',
        allowDarkModeToggle: true,
        customCss: (box.get('customCss') as string) || undefined,
        hideOttabaseBranding: (box.get('hideOttabaseBranding') as boolean) ?? false,
        routeMappings: routeMappings.map((m) => ({
            pathPattern: m.pathPattern,
            layoutTemplateId: m.layoutTemplateId,
            priority: m.priority ?? 0,
        })),
        layoutTemplatesMap,
    };
}
