// ---------------------------------------------------------------------------
// Brand Engine – Client-side preview theme builder
// Builds ResolvedBrandTheme from BrandKitItem-like data for realtime admin preview
// ---------------------------------------------------------------------------

import type { ResolvedBrandTheme } from './resolver';
import type { BrandTheme } from './theme';
import type { DesignTokens } from './tokens';
import { getThemeOrDefault } from './registry';
import { resolveTheme } from './resolver';

export interface PreviewKitData {
    tokensJson?: string | null;
    themePresetId?: string | null;
}

/**
 * Build ResolvedBrandTheme from kit data (tokensJson, themePresetId).
 * Used for realtime preview in admin UI before saving.
 */
export function buildPreviewTheme(kitData: PreviewKitData, mode: 'light' | 'dark' = 'light'): ResolvedBrandTheme {
    const base = getThemeOrDefault(kitData.themePresetId || 'default');
    let tenantOverrides: Partial<BrandTheme> = {};

    if (kitData.tokensJson) {
        try {
            const parsed = JSON.parse(kitData.tokensJson) as Record<string, unknown>;
            const { cursors: rawCursors, colors: legacyColors, ...tokenRest } = parsed;
            const tokens = { ...tokenRest } as Partial<DesignTokens>;
            if (legacyColors && typeof legacyColors === 'object' && !tokens.color) {
                tokens.color = legacyColors as DesignTokens['color'];
            }
            const cursors = rawCursors as BrandTheme['cursors'] | undefined;
            tenantOverrides = {
                tokens: tokens as DesignTokens,
                cursors: cursors && typeof cursors === 'object' ? cursors : undefined,
            };
        } catch {
            // ignore parse errors
        }
    }

    return resolveTheme({
        base,
        tenantOverrides,
        mode,
    });
}
