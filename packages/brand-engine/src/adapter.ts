// ---------------------------------------------------------------------------
// BrandEngine – Theme JSON adapter
//
// Converts the per-app ThemeConfig JSON format into a BrandTheme.
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import type { BrandTheme } from './theme';
import type { DesignTokens, TokenCursors } from './tokens';

/**
 * Shape of a theme JSON file.
 *
 * All theme-related config lives at the top level:
 *   name, typography, colors, spacing, radius, shadows, motion, layout, cursors
 * plus any v2 token category (palette, typeScale, border, focus, interaction,
 * links, selection, scrollbar, native, zIndex, textStyles, fontFaces, effects,
 * scopes, surface, aliases) — those pass through verbatim.
 */
export interface LegacyThemeConfig extends Partial<Omit<DesignTokens, 'color' | 'shadow'>> {
    name: string;
    typography?: DesignTokens['typography'];
    /** JSON files use the plural `colors` for what DesignTokens calls `color` */
    colors: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
    /** JSON files use the plural `shadows` for what DesignTokens calls `shadow` */
    shadows?: Record<string, string>;
    layout?: {
        header?: string;
        navigation?: string;
        contentWidth?: string;
        footer?: boolean;
        density?: string;
    };
    /** Custom cursor overrides */
    cursors?: Record<string, string>;
}

/** Converts a theme JSON into a `BrandTheme`. */
export function fromLegacyThemeConfig(legacy: LegacyThemeConfig): BrandTheme {
    // Everything that isn't a renamed/relocated field passes through as tokens
    const { name, colors, shadows, layout, cursors, ...tokenRest } = legacy;

    return {
        name,
        tokens: {
            ...(tokenRest as Partial<DesignTokens>),
            color: {
                light: colors.light as BrandTheme['tokens']['color']['light'],
                dark: colors.dark as BrandTheme['tokens']['color']['dark'],
            },
            shadow: shadows as BrandTheme['tokens']['shadow'],
        },
        layout: layout as LayoutConfig | undefined,
        cursors: cursors as TokenCursors | undefined,
    };
}
