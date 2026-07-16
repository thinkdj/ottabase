// ---------------------------------------------------------------------------
// @ottabase/brand-engine – Public API
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────
export type {
    ColorPalettes,
    ColorScheme,
    DesignTokens,
    ModeValue,
    ResolvedMotion,
    ScopeTokens,
    TokenAliases,
    TokenBorder,
    TokenCategoryKey,
    TokenColors,
    TokenCursors,
    TokenDisabledFlags,
    TokenEffects,
    TokenFocus,
    TokenFontFace,
    TokenInteraction,
    TokenLinks,
    TokenMotion,
    TokenNative,
    TokenPalette,
    TokenRadius,
    TokenScopes,
    TokenScrollbar,
    TokenSelection,
    TokenShadows,
    TokenSpacing,
    TokenSurface,
    TokenTextStyle,
    TokenTextStyles,
    TokenTypeScale,
    TokenTypography,
    TokenTypographyRoles,
    TokenZIndex,
    TypeScaleStep,
} from './tokens';

export { TOKEN_CATEGORY_KEYS, isReservedVarName } from './tokens';

export type {
    BrandKitItem,
    CreateMenuItemPayload,
    CreateMenuPayload,
    LayoutMappingItem,
    LayoutTemplateItem,
    MenuSlotAssignmentItem,
    MenuSlotRenderType,
    MenuWithItemsDto,
    ResolvedMenuSlot,
    UpdateBrandKitPayload,
    UpdateMenuItemPayload,
    UpdateMenuPayload,
} from './persistence';

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
    DEFAULT_SHADOWS_DARK,
    DEFAULT_SPACING,
} from './defaults';

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
    CUSTOM_CSS_STYLE_ID,
    EFFECTS_STYLE_ID,
    INITIAL_CONFIG_ELEMENT_ID,
    buildCriticalCSS,
    buildCriticalCSSDual,
    buildCriticalStyleTag,
    buildCriticalStyleTagDual,
    buildCustomCssStyleTag,
    buildEffectsStyleTag,
    buildInitialConfigScriptTag,
} from './css-critical';
export {
    applyBrandTheme,
    buildBrandStylesheet,
    buildCSSVarMap,
    injectCSSVars,
    injectFont,
    upsertStyleElement,
} from './css-runtime';
export { deepMerge, resolveAliases, resolveTheme } from './resolver';
export { isModeSplit, pickMode, resolveTokenSet } from './resolve-core';
export type { ResolvedTokenSet } from './resolve-core';

// ── Effects (generated CSS + registries) ───────────────────────────────────
export { EFFECT_REGISTRY, KEYFRAME_REGISTRY, buildEffectsCSS, buildScopesCSS, resolveRegistryValue } from './effects';

// ── Validators ─────────────────────────────────────────────────────────────
export { isValidBrandTheme, isValidJSON, isValidTokenColors, safeParseJSON } from './validators';

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

// ── Layout defaults (brand-engine-owned) ──────────────────────────────────
export { DEFAULT_ROUTE_MAPPINGS } from './layouts';

// ── Fonts ──────────────────────────────────────────────────────────────────
export { GOOGLE_FONTS, buildGoogleFontUrl, fontToTypography, type GoogleFontMeta } from './fonts';

// ── Cursors ────────────────────────────────────────────────────────────────
export { CURSOR_SVG_REGISTRY, getAvailableCursors, getCursorSvg, resolveCursor, type CursorDef } from './cursors';

// ── Built-in themes ────────────────────────────────────────────────────────
export {
    BUILTIN_THEME_NAMES,
    THEME_PRESET_ITEMS,
    getThemePresetItems,
    registerBuiltInThemes,
    type ThemePresetItem,
} from './themes';

export { PRESET_MAP, PRESET_THEMES, type PresetTheme } from './presets';

// ── Preview (admin) ────────────────────────────────────────────────────────
export { buildPreviewTheme, type PreviewKitData } from './previewTheme';

// ── Email & favicon ───────────────────────────────────────────────────────
export { applyBrandToEmail } from './email/brand-email';
export { getFaviconUrl } from './favicon';
