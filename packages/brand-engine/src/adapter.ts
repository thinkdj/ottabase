// ---------------------------------------------------------------------------
// BrandEngine – Theme JSON adapter
//
// Converts the per-app ThemeConfig JSON format into a BrandTheme.
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import type { BrandTheme } from './theme';
import type { TokenCursors } from './tokens';

/**
 * Shape of a theme JSON file.
 *
 * All theme-related config lives at the top level:
 *   name, typography, colors, spacing, radius, shadows, motion, layout, cursors
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
    /** Custom cursor overrides */
    cursors?: Record<string, string>;
}

/** Converts a theme JSON into a `BrandTheme`. */
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
        cursors: legacy.cursors as TokenCursors | undefined,
    };
}
