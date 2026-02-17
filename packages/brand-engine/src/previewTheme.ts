// ---------------------------------------------------------------------------
// Brand Engine – Client-side preview theme builder
// Builds ResolvedBrandTheme from BrandKitItem-like data for realtime admin preview
// ---------------------------------------------------------------------------

import { getThemeOrDefault } from './registry';
import type { ResolvedBrandTheme } from './resolver';
import { resolveTheme } from './resolver';
import type { BrandTheme } from './theme';
import type { DesignTokens } from './tokens';

export interface PreviewKitData {
    tokensJson?: string | null;
    themePresetId?: string | null;
}

/**
 * When preset is set AND no custom color overrides exist, strip color so preset fully overrides.
 * If the tenant has explicit color overrides (user clicked "Apply to Brand Kit"), keep them
 * so they deep-merge on top of the preset colors.
 */
function stripColorsWhenPreset(
    tenantOverrides: Partial<BrandTheme>,
    presetId: string | null,
    hasCustomColors: boolean,
): Partial<BrandTheme> {
    if (!presetId || !tenantOverrides?.tokens || hasCustomColors) return tenantOverrides;
    const { color: _color, ...tokensWithoutColor } = tenantOverrides.tokens;
    return { ...tenantOverrides, tokens: tokensWithoutColor as DesignTokens };
}

/**
 * Build ResolvedBrandTheme from kit data (tokensJson, themePresetId).
 * Used for realtime preview in admin UI before saving.
 * When themePresetId is set, preset colors win (matches brandKitToConfig).
 */
export function buildPreviewTheme(kitData: PreviewKitData, mode: string = 'light'): ResolvedBrandTheme {
    const presetId = kitData.themePresetId || null;
    const base = getThemeOrDefault(presetId || 'default');
    let tenantOverrides: Partial<BrandTheme> = {};

    if (kitData.tokensJson) {
        try {
            const parsed = JSON.parse(kitData.tokensJson) as Record<string, unknown>;
            const { cursors: rawCursors, colors: legacyColors, ...tokenRest } = parsed;
            const tokens = { ...tokenRest } as Partial<DesignTokens>;
            if (legacyColors && typeof legacyColors === 'object' && !tokens.color) {
                tokens.color = legacyColors as DesignTokens['color'];
            }
            const hasCustomColors = !!(tokens.color && typeof tokens.color === 'object');
            const cursors = rawCursors as BrandTheme['cursors'] | undefined;
            tenantOverrides = stripColorsWhenPreset(
                {
                    tokens: tokens as DesignTokens,
                    cursors: cursors && typeof cursors === 'object' ? cursors : undefined,
                },
                presetId,
                hasCustomColors,
            );
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
