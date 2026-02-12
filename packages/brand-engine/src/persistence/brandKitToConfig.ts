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
import { LAYOUT_PRESETS } from '../layouts/presets';

/** Build ResolvedBrandTheme from BrandKit + mode */
export function brandKitToTheme(kit: BrandKit, mode: 'light' | 'dark' = 'light'): ResolvedBrandTheme {
    const tenantTheme = kit.toBrandTheme();
    const presetId = (kit.get('themePresetId') as string) || null;
    const baseTheme: BrandTheme =
        presetId && getThemeByName(presetId) ? getThemeByName(presetId)! : DEFAULT_BRAND_THEME;
    return resolveTheme({
        base: baseTheme,
        tenantOverrides: tenantTheme,
        mode,
    });
}

/** Extract logo URLs from BrandKit */
export function brandKitLogos(kit: BrandKit, r2PublicUrl: string) {
    return kit.getLogoUrls(r2PublicUrl);
}
