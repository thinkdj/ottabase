import {
    type BrandTheme,
    type ResolvedBrandTheme,
    resolveTheme,
    applyBrandTheme,
    getThemeOrDefault,
    getRegisteredThemeNames,
} from '@ottabase/brand-engine';

// Themes are registered in main.tsx via registerBuiltInThemes() before app render

// ---------------------------------------------------------------------------
// Public API – delegates to BrandEngine
// ---------------------------------------------------------------------------

/** Returns list of all registered theme identifiers */
export const getAvailableThemes = (): string[] => getRegisteredThemeNames();

/** Resolves a theme by name with fallback to default */
export const getTheme = (themeName: string): BrandTheme => getThemeOrDefault(themeName);

// ---------------------------------------------------------------------------
// Main apply function – now powered by BrandEngine
// ---------------------------------------------------------------------------

/**
 * Applies a named theme + mode to the document root.
 *
 * Handles: typography (font injection + CSS vars), colour tokens,
 * border-radius, spacing, shadow elevations, motion presets, layout vars,
 * and cursors (registry:, svg:, url() resolved inside BrandEngine).
 *
 * Returns the resolved theme for use in providers / context.
 */
export const applyTheme = (themeName: string, mode: 'light' | 'dark' = 'light'): ResolvedBrandTheme => {
    const base = getThemeOrDefault(themeName);

    if (import.meta.env.DEV) {
        console.log(`[theme] Applying "${themeName}" in ${mode} mode`);
    }

    // Resolve the full theme (merge defaults + mode selection + aliases)
    const resolved = resolveTheme({ base, mode });

    // Inject fonts + CSS vars (including resolved cursors) via BrandEngine runtime
    applyBrandTheme(resolved);

    return resolved;
};
