// ---------------------------------------------------------------------------
// BrandEngine – Theme Resolver
//
// Implements the merge layer:
//   finalTheme = baseTheme + tenantOverrides + modeOverrides (dark/light)
//
// Features:
//   • Deep merge with fallback defaults
//   • Token alias resolution
//   • White-label / multi-tenant support
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { DEFAULT_LAYOUT } from '@ottabase/ottalayout';
import {
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
    DEFAULT_TYPOGRAPHY,
} from './defaults';
import type { BrandTheme } from './theme';
import type {
    ColorScheme,
    ModeValue,
    TokenAliases,
    TokenColors,
    TokenCursors,
    TokenMotion,
    TokenShadows,
    TokenSpacing,
    TokenTypography,
} from './tokens';

// ---------------------------------------------------------------------------
// Deep-merge utility
// ---------------------------------------------------------------------------

/** Type guard – is `val` a plain object (not array, null, etc.)? */
function isPlainObject(val: unknown): val is Record<string, unknown> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Deep-merges `source` into `target`, returning a new object.
 * Arrays and non-plain-objects are replaced, not merged.
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target } as Record<string, unknown>;

    for (const key of Object.keys(source)) {
        const srcVal = (source as Record<string, unknown>)[key];
        const tgtVal = result[key];

        if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
            result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
        } else if (srcVal !== undefined) {
            result[key] = srcVal;
        }
    }

    return result as T;
}

// ---------------------------------------------------------------------------
// Token alias resolution
// ---------------------------------------------------------------------------

/**
 * Resolves aliases within a colour palette.
 * If a token alias key exists, it creates a new property with that key,
 * pointing to the value of the target token.
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

// ---------------------------------------------------------------------------
// Mode extraction utility
// ---------------------------------------------------------------------------

/**
 * Safely extracts the value for the active mode from a ModeValue token.
 */
export function resolveModeValue<T>(
    val: ModeValue<T> | undefined,
    mode: ColorScheme,
    isBase: (v: unknown) => boolean,
): T | undefined {
    if (val === undefined || val === null) return undefined;
    if (isBase(val)) return val as T;

    const modeVal = val as { [scheme: string]: T | undefined };
    return modeVal[mode] ?? modeVal['light'] ?? modeVal['system'];
}

// ---------------------------------------------------------------------------
// ResolvedBrandTheme – the fully-flattened output of the resolver
// ---------------------------------------------------------------------------

/** Resolved theme ready for CSS variable injection */
export interface ResolvedBrandTheme {
    name: string;
    colors: TokenColors;
    typography: {
        heading: TokenTypography;
        body: TokenTypography;
        handwriting: TokenTypography;
    };
    spacing: TokenSpacing;
    radius: string;
    shadows: Required<TokenShadows>;
    motion: Required<TokenMotion>;
    cursors: TokenCursors;
    layout: LayoutConfig;
}

// ---------------------------------------------------------------------------
// Resolve function
// ---------------------------------------------------------------------------

export interface ResolveOptions {
    /** The base (built-in) theme to start from */
    base: BrandTheme;
    /** Optional tenant-level overrides (partial BrandTheme) */
    tenantOverrides?: Partial<BrandTheme>;
    /** Current color-scheme mode (built-in: 'light' | 'dark'; custom schemes also supported) */
    mode?: ColorScheme;
}

/**
 * Resolves a final theme by merging:
 *   base → tenantOverrides → mode selection → alias resolution → defaults
 */
export function resolveTheme(options: ResolveOptions): ResolvedBrandTheme {
    const { base, tenantOverrides, mode = 'light' } = options;

    // 1. Deep-merge base + tenant overrides
    const merged: BrandTheme = tenantOverrides
        ? (deepMerge(
              base as unknown as Record<string, unknown>,
              tenantOverrides as unknown as Record<string, unknown>,
          ) as unknown as BrandTheme)
        : base;

    // 2. Select mode-specific colour palette with fallback chain:
    //    requested mode → light → defaults
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = merged.tokens?.color?.[mode] ?? merged.tokens?.color?.light ?? defaultPalette;
    const palette: TokenColors = { ...defaultPalette, ...rawPalette };

    // 3. Resolve token aliases
    const colors = resolveAliases(palette, merged.tokens?.aliases);

    // 4. Merge remaining tokens with defaults, applying mode overrides
    const rawTypo = resolveModeValue(
        merged.tokens?.typography,
        mode,
        (v: any) => 'heading' in v || 'body' in v || 'handwriting' in v,
    );
    const typography = {
        heading: { ...DEFAULT_TYPOGRAPHY.heading, ...rawTypo?.heading } as TokenTypography,
        body: { ...DEFAULT_TYPOGRAPHY.body, ...rawTypo?.body } as TokenTypography,
        handwriting: { ...DEFAULT_TYPOGRAPHY.handwriting, ...rawTypo?.handwriting } as TokenTypography,
    };

    const isStringMap = (v: any) =>
        typeof v === 'object' && v !== null && Object.values(v).every((x) => typeof x === 'string');

    const rawSpacing = resolveModeValue(merged.tokens?.spacing, mode, isStringMap);
    const spacing = { ...DEFAULT_SPACING, ...rawSpacing };

    const rawRadius = resolveModeValue(merged.tokens?.radius, mode, (v) => typeof v === 'string');
    const radius = rawRadius ?? '0.5rem';

    const rawShadows = resolveModeValue(merged.tokens?.shadow, mode, isStringMap);
    const shadows = { ...DEFAULT_SHADOWS, ...(rawShadows ?? {}) };

    const rawMotion = resolveModeValue(merged.tokens?.motion, mode, isStringMap);
    const motion = { ...DEFAULT_MOTION, ...(rawMotion ?? {}) };

    const rawCursors = resolveModeValue(merged.cursors, mode, isStringMap);
    const cursors = rawCursors ?? DEFAULT_CURSORS;

    const layout = { ...DEFAULT_LAYOUT, ...merged.layout };

    return {
        name: merged.name,
        colors,
        typography,
        spacing,
        radius,
        shadows,
        motion,
        cursors,
        layout,
    };
}
