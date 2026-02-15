// ---------------------------------------------------------------------------
// @ottabase/brand-engine – Public API
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────
export type {
    ColorPalettes,
    ColorScheme,
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

export type { BrandKitItem, LayoutMappingItem, LayoutTemplateItem, UpdateBrandKitPayload } from './persistence';

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
export {
    buildTokensFromBaseColor,
    calculateContrastRatio,
    generatePalette,
    generateSemanticDefaults,
    generateSemanticDefaultsDark,
    hexToHsl,
} from './colors';
export type { SemanticPalette } from './colors';
export {
    CRITICAL_STYLE_ID,
    buildCriticalCSS,
    buildCriticalCSSDual,
    buildCriticalStyleTag,
    buildCriticalStyleTagDual,
} from './css-critical';
export { applyBrandTheme, buildCSSVarMap, injectCSSVars, injectFont } from './css-runtime';
export { deepMerge, resolveAliases, resolveTheme } from './resolver';

// ── Validators ─────────────────────────────────────────────────────────────
export {
    isValidBrandTheme,
    isValidJSON,
    isValidLayoutConfig,
    isValidPathPattern,
    isValidTokenColors,
    mergeLayoutConfig,
    safeParseJSON,
} from './validators';

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
export { DEFAULT_ROUTE_MAPPINGS } from './layouts';
export { APP_SHELL_LAYOUT, DOCS_LAYOUT, HOMEPAGE_LAYOUT, LAYOUT_PRESETS, MINIMAL_LAYOUT } from './layouts/presets';
export type { LayoutComponentKey, LayoutPreset } from './layouts/presets';
export { pathPatternToRegex, resolveLayoutForPath, resolveRouteForPath } from './layouts/resolver';
export type { RouteMatchResult } from './layouts/resolver';

// ── Fonts ──────────────────────────────────────────────────────────────────
export { GOOGLE_FONTS, buildGoogleFontUrl, fontToTypography, type GoogleFontMeta } from './fonts';

// ── Cursors ────────────────────────────────────────────────────────────────
export { CURSOR_SVG_REGISTRY, getAvailableCursors, getCursorSvg, resolveCursor } from './cursors';

// ── Built-in themes ────────────────────────────────────────────────────────
export {
    BUILTIN_THEME_NAMES,
    THEME_PRESET_ITEMS,
    getThemePresetItems,
    registerBuiltInThemes,
    type ThemePresetItem,
} from './themes';

// ── Preview (admin) ────────────────────────────────────────────────────────
export { buildPreviewTheme, type PreviewKitData } from './previewTheme';

// ── Email & favicon ───────────────────────────────────────────────────────
export { applyBrandToEmail } from './email/brand-email';
export { getFaviconUrl } from './favicon';
