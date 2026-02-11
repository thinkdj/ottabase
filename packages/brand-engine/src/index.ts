// ---------------------------------------------------------------------------
// @ottabase/brand-engine – Public API
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────
export type {
    DesignTokens,
    TokenAliases,
    TokenColors,
    TokenCursors,
    TokenMotion,
    TokenShadows,
    TokenSpacing,
    TokenTypography,
} from './tokens';

export type { ContentWidth, Density, HeaderVariant, LayoutConfig, NavigationVariant } from './layout';

export type { LegacyThemeConfig } from './adapter';
export type { ResolveOptions, ResolvedBrandTheme } from './resolver';
export type { BrandTheme } from './theme';

// ── Constants / Defaults ───────────────────────────────────────────────────
export {
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
} from './defaults';
export { DEFAULT_LAYOUT } from './layout';

// ── Core functions ─────────────────────────────────────────────────────────
export { createTokenAccessor, getToken } from './accessors';
export { calculateContrastRatio, generatePalette, generateSemanticDefaults, hexToHsl } from './colors';
export type { SemanticPalette } from './colors';
export { applyBrandTheme, buildCSSVarMap, injectCSSVars, injectFont } from './css-runtime';
export { deepMerge, resolveAliases, resolveTheme } from './resolver';

// ── Registry ───────────────────────────────────────────────────────────────
export {
    clearThemeRegistry,
    getRegisteredThemeNames,
    getThemeByName,
    getThemeOrDefault,
    registerTheme,
    registerThemes,
} from './registry';

// ── Legacy adapter ─────────────────────────────────────────────────────────
export { fromLegacyThemeConfig } from './adapter';

// ── Layout system ─────────────────────────────────────────────────────────
export { pathPatternToRegex, resolveLayoutForPath } from './layouts/resolver';
export { HOMEPAGE_LAYOUT, APP_SHELL_LAYOUT, DOCS_LAYOUT, MINIMAL_LAYOUT, LAYOUT_PRESETS } from './layouts/presets';
export type { LayoutComponentKey, LayoutPreset } from './layouts/presets';
