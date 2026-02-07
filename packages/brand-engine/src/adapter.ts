// ---------------------------------------------------------------------------
// BrandEngine – Theme JSON adapter
//
// Converts the per-app ThemeConfig JSON format into a BrandTheme.
// Supports both the current flat format (cursors at top level) and the
// legacy nested format (appearance.cursors) for backward compatibility.
// ---------------------------------------------------------------------------

import type { BrandTheme } from './theme';
import type { TokenCursors } from './tokens';
import type { LayoutConfig } from './layout';

/**
 * Shape of a theme JSON file.
 *
 * All theme-related config lives at the top level:
 *   name, typography, colors, spacing, radius, shadows, motion, layout, cursors
 *
 * The legacy `appearance.cursors` nesting is still accepted for backward compat.
 */
export interface LegacyThemeConfig {
    name: string;
    typography: {
        heading: { fontFamily: string; url?: string };
        body: { fontFamily: string; url?: string };
        handwriting: { fontFamily: string; url?: string };
    };
    colors: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
    spacing?: Record<string, string>;
    radius?: string;
    shadows?: Record<string, string>;
    motion?: {
        durationFast?: string;
        durationNormal?: string;
        durationSlow?: string;
        easing?: string;
        easingEnter?: string;
        easingExit?: string;
    };
    layout?: {
        header?: string;
        navigation?: string;
        contentWidth?: string;
        footer?: boolean;
        density?: string;
    };
    /** Top-level cursors (preferred) */
    cursors?: Record<string, string>;
    /** @deprecated Use top-level `cursors` instead */
    appearance?: {
        cursors?: Record<string, string>;
    };
}

/**
 * Converts a theme JSON into a `BrandTheme`.
 * Reads cursors from top-level `cursors` first, falls back to `appearance.cursors`.
 */
export function fromLegacyThemeConfig(legacy: LegacyThemeConfig): BrandTheme {
    return {
        name: legacy.name,
        tokens: {
            color: {
                light: legacy.colors.light as BrandTheme['tokens']['color']['light'],
                dark: legacy.colors.dark as BrandTheme['tokens']['color']['dark'],
            },
            typography: legacy.typography,
            spacing: legacy.spacing,
            radius: legacy.radius,
            shadow: legacy.shadows as BrandTheme['tokens']['shadow'],
            motion: legacy.motion,
        },
        layout: legacy.layout as LayoutConfig | undefined,
        cursors: (legacy.cursors ?? legacy.appearance?.cursors) as TokenCursors | undefined,
    };
}
