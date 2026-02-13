// ---------------------------------------------------------------------------
// Brand Engine – Convert BrandKit to theme/identity for ResolvedBrandConfig
// ---------------------------------------------------------------------------

import type { BrandKit } from './BrandKit.model';
import type { DesignTokens } from '../tokens';
import type { BrandTheme } from '../theme';
import type { ResolvedBrandTheme } from '../resolver';
import { DEFAULT_BRAND_THEME } from '../defaults';
import { getThemeByName } from '../registry';
import { resolveTheme } from '../resolver';
import type { LayoutConfig } from '../layout';

/**
 * When a preset is selected, it fully overrides color palette (buttons, sidebar, etc.).
 * Strips color from tenantOverrides so preset colors win; tokensJson color is ignored.
 * Other tokens (typography, spacing, radius, etc.) can still override the preset.
 */
function tenantOverridesForPreset(tenantTheme: BrandTheme, presetId: string | null): Partial<BrandTheme> {
    if (!presetId || !tenantTheme?.tokens) return tenantTheme;
    const { color: _color, ...tokensWithoutColor } = tenantTheme.tokens;
    return {
        ...tenantTheme,
        tokens: tokensWithoutColor as DesignTokens,
    };
}

/** Build ResolvedBrandTheme from BrandKit + mode */
export function brandKitToTheme(kit: BrandKit, mode: 'light' | 'dark' = 'light'): ResolvedBrandTheme {
    const tenantTheme = kit.toBrandTheme();
    const presetId = (kit.get('themePresetId') as string) || null;
    const baseTheme: BrandTheme =
        presetId && getThemeByName(presetId) ? getThemeByName(presetId)! : DEFAULT_BRAND_THEME;
    const overrides = tenantOverridesForPreset(tenantTheme, presetId);
    return resolveTheme({
        base: baseTheme,
        tenantOverrides: overrides,
        mode,
    });
}

/** Extract logo URLs from BrandKit */
export function brandKitLogos(kit: BrandKit, r2PublicUrl: string) {
    return kit.getLogoUrls(r2PublicUrl);
}
