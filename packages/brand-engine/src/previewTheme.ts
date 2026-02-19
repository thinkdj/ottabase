// ---------------------------------------------------------------------------
// Brand Engine – Client-side preview theme builder
// Builds ResolvedBrandTheme from BrandKitItem-like data for realtime admin preview
// Works with preset-as-template architecture (no registry needed)
// ---------------------------------------------------------------------------

import { DEFAULT_LAYOUT } from '@ottabase/ottalayout';
import {
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
} from './defaults';
import type { ResolvedBrandTheme } from './resolver';
import type { DesignTokens, TokenColors } from './tokens';

export interface PreviewKitData {
    tokensJson?: string | null;
    themePresetId?: string | null;
}

/**
 * Build ResolvedBrandTheme from kit data (tokensJson).
 * Used for realtime preview in admin UI before saving.
 *
 * With preset-as-template architecture, tokensJson contains the complete expanded theme,
 * so we just read it directly (no registry lookups needed).
 */
export function buildPreviewTheme(kitData: PreviewKitData, mode: string = 'light'): ResolvedBrandTheme {
    let tokens: Partial<DesignTokens> = {};

    // Parse tokensJson (contains expanded theme if preset was selected)
    if (kitData.tokensJson) {
        try {
            const parsed = JSON.parse(kitData.tokensJson) as Record<string, unknown>;
            const { cursors: _cursors, colors: legacyColors, ...tokenRest } = parsed;
            tokens = { ...tokenRest } as Partial<DesignTokens>;

            // Handle legacy colors -> color migration
            if (legacyColors && typeof legacyColors === 'object' && !tokens.color) {
                tokens.color = legacyColors as DesignTokens['color'];
            }
        } catch {
            // If parsing fails, use defaults
            tokens = {};
        }
    }

    // Get mode-specific colors from tokensJson
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = tokens.color?.[mode] ?? tokens.color?.light ?? defaultPalette;
    const colors = { ...defaultPalette, ...rawPalette } as TokenColors;

    // Extract other design tokens with defaults
    const typography = tokens.typography ?? {
        heading: { fontFamily: 'Inter' },
        body: { fontFamily: 'Inter' },
        handwriting: { fontFamily: 'Caveat' },
    };
    const spacing = tokens.spacing ?? DEFAULT_SPACING;
    const radius = tokens.radius ?? '0.5rem';
    const shadows = { ...DEFAULT_SHADOWS, ...(tokens.shadow ?? {}) };
    const motion = { ...DEFAULT_MOTION, ...(tokens.motion ?? {}) };

    return {
        name: kitData.themePresetId || 'custom',
        colors,
        typography,
        spacing,
        radius,
        shadows,
        motion,
        cursors: DEFAULT_CURSORS,
        layout: DEFAULT_LAYOUT,
    };
}
