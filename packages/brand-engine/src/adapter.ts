// ---------------------------------------------------------------------------
// BrandEngine – Legacy ThemeConfig adapter
//
// Converts the existing per-app ThemeConfig JSON format into a BrandTheme
// so that the 8 bundled themes (default, neo, crisp, …) work seamlessly
// with the new engine without requiring immediate migration of the JSON files.
// ---------------------------------------------------------------------------

import type { BrandTheme } from './theme';
import type { TokenCursors } from './tokens';

/**
 * Shape of the legacy ThemeConfig JSON that exists in
 * app-level config/themes directories.
 *
 * Kept intentionally as an interface so callers can cast as LegacyThemeConfig.
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
    appearance?: {
        cursors?: Record<string, string>;
    };
}

/**
 * Converts a legacy `ThemeConfig` JSON into a `BrandTheme`.
 * All fields are mapped 1-to-1; layout defaults to `undefined` (resolver
 * supplies defaults).
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
        cursors: legacy.appearance?.cursors as TokenCursors | undefined,
    };
}
