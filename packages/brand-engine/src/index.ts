// ---------------------------------------------------------------------------
// @ottabase/brand-engine – Public API
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────
export type {
    TokenTypography,
    TokenColors,
    TokenShadows,
    TokenMotion,
    TokenCursors,
    TokenSpacing,
    TokenAliases,
    DesignTokens,
} from './tokens';

export type { HeaderVariant, NavigationVariant, ContentWidth, Density, LayoutConfig } from './layout';

export type { BrandTheme } from './theme';
export type { ResolvedBrandTheme, ResolveOptions } from './resolver';
export type { LegacyThemeConfig } from './adapter';

// ── Constants / Defaults ───────────────────────────────────────────────────
export { DEFAULT_LAYOUT } from './layout';
export {
    DEFAULT_COLORS_LIGHT,
    DEFAULT_COLORS_DARK,
    DEFAULT_SHADOWS,
    DEFAULT_MOTION,
    DEFAULT_CURSORS,
    DEFAULT_SPACING,
} from './defaults';

// ── Core functions ─────────────────────────────────────────────────────────
export { resolveTheme, deepMerge, resolveAliases } from './resolver';
export { buildCSSVarMap, injectCSSVars, injectFont, applyBrandTheme } from './css-runtime';

// ── Registry ───────────────────────────────────────────────────────────────
export {
    registerThemes,
    registerTheme,
    getThemeByName,
    getThemeOrDefault,
    getRegisteredThemeNames,
    clearThemeRegistry,
} from './registry';

// ── Legacy adapter ─────────────────────────────────────────────────────────
export { fromLegacyThemeConfig } from './adapter';
