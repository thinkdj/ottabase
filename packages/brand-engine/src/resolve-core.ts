// ---------------------------------------------------------------------------
// BrandEngine – Shared token-resolution core
//
// Single implementation of per-category token resolution used by all three
// resolution entry points (resolver.ts registry path, persistence
// brandKitToConfig.ts kit path, previewTheme.ts admin preview) — previously
// three hand-rolled copies that drifted.
//
// Category families:
//   • DEFAULTED (color, typography, spacing, radius, shadow, motion): engine
//     defaults merged under the theme values — vars are always emitted.
//   • SPARSE (palette, typeScale, border, focus, interaction, links,
//     selection, scrollbar, native, zIndex, textStyles, fontFaces, effects,
//     scopes, surface): resolved only when the theme defines them; consumers
//     carry the pixel-identical fallbacks.
// ---------------------------------------------------------------------------

import {
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SHADOWS_DARK,
    DEFAULT_SPACING,
    DEFAULT_TYPOGRAPHY,
    SYSTEM_TYPOGRAPHY,
} from './defaults';
import type {
    ColorScheme,
    DesignTokens,
    ModeValue,
    ResolvedMotion,
    TokenAliases,
    TokenBorder,
    TokenColors,
    TokenCursors,
    TokenEffects,
    TokenFocus,
    TokenFontFace,
    TokenInteraction,
    TokenLinks,
    TokenNative,
    TokenPalette,
    TokenRadius,
    TokenScopes,
    TokenScrollbar,
    TokenSelection,
    TokenSpacing,
    TokenSurface,
    TokenTextStyles,
    TokenTypeScale,
    TokenTypographyRoles,
} from './tokens';
import { isReservedVarName } from './tokens';

// ---------------------------------------------------------------------------
// Mode-split detection
// ---------------------------------------------------------------------------

/** Type guard – is `val` a plain object (not array, null, etc.)? */
export function isPlainObject(val: unknown): val is Record<string, unknown> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * A ModeValue is treated as mode-SPLIT iff it is a plain object carrying a
 * `light` or `dark` key. This replaces the old per-category `isStringMap`
 * heuristics, which misclassified base values containing non-string fields
 * (e.g. `motion.disableAnimations: true` made the whole motion object look
 * like a split and silently dropped it in the kit pipeline).
 */
export function isModeSplit(val: unknown): val is { [scheme: string]: unknown } {
    return isPlainObject(val) && ('light' in val || 'dark' in val);
}

/** Extract the active-mode value from a ModeValue token (base values pass through). */
export function pickMode<T>(val: ModeValue<T> | undefined, mode: ColorScheme): T | undefined {
    if (val === undefined || val === null) return undefined;
    if (!isModeSplit(val)) return val as T;
    const split = val as { [scheme: string]: T | undefined };
    return split[mode] ?? split['light'];
}

// ---------------------------------------------------------------------------
// Defaulted categories
// ---------------------------------------------------------------------------

/** Resolve the semantic color palette for a mode (defaults merged under). */
export function resolveColors(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenColors {
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = tokens?.color?.[mode] ?? tokens?.color?.light ?? defaultPalette;
    return { ...defaultPalette, ...rawPalette } as TokenColors;
}

/**
 * Resolve color aliases: each alias key becomes a palette entry pointing at
 * the target token's value (`{ brand: 'primary' }` → colors.brand = colors.primary).
 */
export function resolveAliases(palette: TokenColors, aliases?: TokenAliases): TokenColors {
    if (!aliases || Object.keys(aliases).length === 0) return palette;

    const resolved = { ...palette };
    for (const [alias, target] of Object.entries(aliases)) {
        if (target in palette) {
            resolved[alias] = palette[target]!;
        }
    }
    return resolved;
}

/**
 * Resolve typography roles: default roles merged per-field, extra roles passed
 * through. `disabled.fonts` swaps in system stacks and ignores theme values —
 * no web-font URLs are emitted.
 */
export function resolveTypography(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenTypographyRoles {
    const fontsDisabled = tokens?.disabled?.fonts === true;
    const defaults = fontsDisabled ? SYSTEM_TYPOGRAPHY : DEFAULT_TYPOGRAPHY;
    const raw = fontsDisabled ? undefined : pickMode(tokens?.typography, mode);
    const roles: TokenTypographyRoles = {};
    // Default roles (heading/body/handwriting/mono) merge field-wise with theme values
    for (const [role, def] of Object.entries(defaults)) {
        roles[role] = { ...def, ...raw?.[role] };
    }
    // Theme-invented roles (display, ticker, …) pass through as-is
    if (raw) {
        for (const [role, val] of Object.entries(raw)) {
            if (!(role in roles) && val && typeof val === 'object') {
                roles[role] = val;
            }
        }
    }
    return roles;
}

export function resolveSpacing(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenSpacing {
    const raw = pickMode(tokens?.spacing, mode);
    return { ...DEFAULT_SPACING, ...(raw ?? {}) };
}

/**
 * Resolve radius: scalar string or per-size record.
 * Returns the scalar `radius` (backs `--radius` and the calc-chain fallbacks)
 * plus a sparse `radiusScale` when a record was provided.
 */
export function resolveRadius(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): { radius: string; radiusScale?: Record<string, string> } {
    const raw = pickMode<TokenRadius>(tokens?.radius, mode);
    if (raw === undefined) return { radius: '0.5rem' };
    if (typeof raw === 'string') return { radius: raw };

    const scale: Record<string, string> = {};
    for (const [size, val] of Object.entries(raw)) {
        if (typeof val === 'string') scale[size] = val;
    }
    // The scalar keeps calc-chain fallbacks meaningful: base > lg > default
    const radius = scale['base'] ?? scale['lg'] ?? '0.5rem';
    delete scale['base']; // `base` is only a scalar source, not an emitted size
    return { radius, radiusScale: Object.keys(scale).length > 0 ? scale : undefined };
}

/** Resolve shadow scale (open record; xs..xl defaulted per mode). */
export function resolveShadows(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): Record<string, string> {
    const raw = pickMode(tokens?.shadow, mode);
    const defaults = mode === 'dark' ? DEFAULT_SHADOWS_DARK : DEFAULT_SHADOWS;
    const merged: Record<string, string> = { ...defaults };
    if (raw) {
        for (const [name, val] of Object.entries(raw)) {
            if (typeof val === 'string') merged[name] = val;
        }
    }
    return merged;
}

/**
 * Resolve motion presets (base fields defaulted; named extras pass through).
 * `disabled.motion` forces disableAnimations — every duration var emits 0s.
 */
export function resolveMotion(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): ResolvedMotion {
    const raw = pickMode(tokens?.motion, mode);
    const motion = { ...DEFAULT_MOTION, ...(raw ?? {}) } as ResolvedMotion;
    if (tokens?.disabled?.motion === true) motion.disableAnimations = true;
    return motion;
}

// ---------------------------------------------------------------------------
// Sparse categories
// ---------------------------------------------------------------------------

/**
 * Resolve the raw/derived palette: values emitted verbatim as `--{name}`.
 * Drops names that would shadow engine-emitted vars or semantic color tokens.
 */
export function resolvePalette(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
    colors?: TokenColors,
): TokenPalette | undefined {
    const raw = pickMode(tokens?.palette, mode);
    if (!raw) return undefined;

    const clean: TokenPalette = {};
    for (const [name, val] of Object.entries(raw)) {
        if (typeof val !== 'string') continue;
        if (isReservedVarName(name) || (colors && name in colors)) {
            console.warn(`[Brand Engine] palette key "${name}" shadows an engine variable — dropped.`);
            continue;
        }
        clean[name] = val;
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
}

export function resolveTypeScale(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): TokenTypeScale | undefined {
    return pickMode(tokens?.typeScale, mode);
}

export function resolveBorder(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenBorder | undefined {
    return pickMode(tokens?.border, mode);
}

export function resolveFocus(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenFocus | undefined {
    return pickMode(tokens?.focus, mode);
}

export function resolveInteraction(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): TokenInteraction | undefined {
    return pickMode(tokens?.interaction, mode);
}

export function resolveLinks(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenLinks | undefined {
    return pickMode(tokens?.links, mode);
}

export function resolveSelection(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): TokenSelection | undefined {
    return pickMode(tokens?.selection, mode);
}

export function resolveScrollbar(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): TokenScrollbar | undefined {
    return pickMode(tokens?.scrollbar, mode);
}

export function resolveNative(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenNative | undefined {
    return pickMode(tokens?.native, mode);
}

/** Resolve z-index ladder, normalizing numbers to strings. */
export function resolveZIndex(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): Record<string, string> | undefined {
    const raw = pickMode(tokens?.zIndex, mode);
    if (!raw) return undefined;
    const clean: Record<string, string> = {};
    for (const [name, val] of Object.entries(raw)) {
        if (typeof val === 'number' || typeof val === 'string') clean[name] = String(val);
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
}

export function resolveTextStyles(
    tokens: Partial<DesignTokens> | undefined,
    mode: ColorScheme,
): TokenTextStyles | undefined {
    return pickMode(tokens?.textStyles, mode);
}

export function resolveSurface(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): TokenSurface | undefined {
    return pickMode(tokens?.surface, mode);
}

/** fontFaces / effects / scopes are never mode-split — verbatim passthrough. */
export function resolveFontFaces(tokens: Partial<DesignTokens> | undefined): TokenFontFace[] | undefined {
    if (tokens?.disabled?.fonts === true) return undefined;
    const raw = tokens?.fontFaces;
    return Array.isArray(raw) && raw.length > 0 ? raw : undefined;
}

/**
 * Resolve cursors (they live at the tokensJson/BrandTheme ROOT, not inside
 * DesignTokens — `tokens` is passed only for the `disabled.cursors` flag).
 * Disabled → empty map → no --cursor-* vars → native browser cursors.
 */
export function resolveCursors(
    tokens: Partial<DesignTokens> | undefined,
    rawCursors: ModeValue<TokenCursors> | undefined,
    mode: ColorScheme,
): TokenCursors {
    if (tokens?.disabled?.cursors === true) return {};
    return pickMode(rawCursors, mode) ?? DEFAULT_CURSORS;
}

export function resolveEffects(tokens: Partial<DesignTokens> | undefined): TokenEffects | undefined {
    const raw = tokens?.effects;
    return isPlainObject(raw) ? (raw as TokenEffects) : undefined;
}

export function resolveScopes(tokens: Partial<DesignTokens> | undefined): TokenScopes | undefined {
    const raw = tokens?.scopes;
    if (!isPlainObject(raw) || Object.keys(raw).length === 0) return undefined;
    return raw as TokenScopes;
}

// ---------------------------------------------------------------------------
// Aggregate: every token category resolved for one mode
// ---------------------------------------------------------------------------

/** All DesignTokens categories resolved for a single mode (layout/cursors excluded — they live outside DesignTokens). */
export interface ResolvedTokenSet {
    colors: TokenColors;
    typography: TokenTypographyRoles;
    spacing: TokenSpacing;
    radius: string;
    shadows: Record<string, string>;
    motion: ResolvedMotion;
    // sparse
    palette?: TokenPalette;
    typeScale?: TokenTypeScale;
    radiusScale?: Record<string, string>;
    border?: TokenBorder;
    focus?: TokenFocus;
    interaction?: TokenInteraction;
    links?: TokenLinks;
    selection?: TokenSelection;
    scrollbar?: TokenScrollbar;
    native?: TokenNative;
    zIndex?: Record<string, string>;
    textStyles?: TokenTextStyles;
    fontFaces?: TokenFontFace[];
    effects?: TokenEffects;
    scopes?: TokenScopes;
    surface?: TokenSurface;
}

/** Assigns only defined sparse values (keeps resolved themes JSON-lean). */
function assignSparse<T extends object, K extends keyof T>(target: T, key: K, val: T[K] | undefined): void {
    if (val !== undefined) target[key] = val;
}

/**
 * Resolve every token category for `mode`. The single implementation behind
 * resolveTheme (registry path), brandKitToTheme light path, and buildPreviewTheme.
 */
export function resolveTokenSet(tokens: Partial<DesignTokens> | undefined, mode: ColorScheme): ResolvedTokenSet {
    const colors = resolveAliases(resolveColors(tokens, mode), tokens?.aliases);
    const { radius, radiusScale } = resolveRadius(tokens, mode);

    const set: ResolvedTokenSet = {
        colors,
        typography: resolveTypography(tokens, mode),
        spacing: resolveSpacing(tokens, mode),
        radius,
        shadows: resolveShadows(tokens, mode),
        motion: resolveMotion(tokens, mode),
    };

    assignSparse(set, 'palette', resolvePalette(tokens, mode, colors));
    assignSparse(set, 'typeScale', resolveTypeScale(tokens, mode));
    assignSparse(set, 'radiusScale', radiusScale);
    assignSparse(set, 'border', resolveBorder(tokens, mode));
    assignSparse(set, 'focus', resolveFocus(tokens, mode));
    assignSparse(set, 'interaction', resolveInteraction(tokens, mode));
    assignSparse(set, 'links', resolveLinks(tokens, mode));
    assignSparse(set, 'selection', resolveSelection(tokens, mode));
    assignSparse(set, 'scrollbar', resolveScrollbar(tokens, mode));
    assignSparse(set, 'native', resolveNative(tokens, mode));
    assignSparse(set, 'zIndex', resolveZIndex(tokens, mode));
    assignSparse(set, 'textStyles', resolveTextStyles(tokens, mode));
    assignSparse(set, 'fontFaces', resolveFontFaces(tokens));
    assignSparse(set, 'effects', resolveEffects(tokens));
    assignSparse(set, 'scopes', resolveScopes(tokens));
    assignSparse(set, 'surface', resolveSurface(tokens, mode));

    return set;
}

/**
 * Category keys whose raw token value carries an explicit `{ dark: … }` split.
 * Used by the kit pipeline to build the minimal dark DELTA: colors and shadows
 * are ALWAYS included (their dark defaults differ from light); every other
 * category is included only when explicitly split. fontFaces/effects/scopes
 * are never mode-split — they ride the light theme object.
 */
export function darkSplitCategories(tokens: Partial<DesignTokens> | undefined): Set<string> {
    const split = new Set<string>();
    if (!tokens) return split;
    const modeAware: (keyof DesignTokens)[] = [
        'palette',
        'typography',
        'typeScale',
        'spacing',
        'radius',
        'border',
        'motion',
        'focus',
        'interaction',
        'links',
        'selection',
        'scrollbar',
        'native',
        'zIndex',
        'textStyles',
        'surface',
    ];
    for (const key of modeAware) {
        const raw = tokens[key];
        if (isPlainObject(raw) && 'dark' in raw) split.add(key);
    }
    return split;
}
