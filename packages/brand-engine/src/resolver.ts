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

import {
    DEFAULT_COLORS_DARK,
    DEFAULT_COLORS_LIGHT,
    DEFAULT_CURSORS,
    DEFAULT_MOTION,
    DEFAULT_SHADOWS,
    DEFAULT_SPACING,
} from './defaults';
import type { LayoutConfig } from './layout';
import { DEFAULT_LAYOUT } from './layout';
import type { BrandTheme } from './theme';
import type { DesignTokens, TokenAliases, TokenColors } from './tokens';

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
// ResolvedBrandTheme – the fully-flattened output of the resolver
// ---------------------------------------------------------------------------

/** Resolved theme ready for CSS variable injection */
export interface ResolvedBrandTheme {
    name: string;
    colors: TokenColors;
    typography: DesignTokens['typography'];
    spacing: NonNullable<DesignTokens['spacing']>;
    radius: string;
    shadows: Required<NonNullable<DesignTokens['shadow']>>;
    motion: Required<NonNullable<DesignTokens['motion']>>;
    cursors: NonNullable<BrandTheme['cursors']>;
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
    /** Current colour-scheme mode */
    mode?: 'light' | 'dark';
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

    // 2. Select mode-specific colour palette with defaults
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = merged.tokens.color[mode] ?? defaultPalette;
    const palette: TokenColors = { ...defaultPalette, ...rawPalette };

    // 3. Resolve token aliases
    const colors = resolveAliases(palette, merged.tokens.aliases);

    // 4. Merge remaining tokens with defaults
    const typography = merged.tokens.typography;
    const spacing = merged.tokens.spacing ?? DEFAULT_SPACING;
    const radius = merged.tokens.radius ?? '0.5rem';
    const shadows = { ...DEFAULT_SHADOWS, ...merged.tokens.shadow };
    const motion = { ...DEFAULT_MOTION, ...merged.tokens.motion };
    const cursors = merged.cursors ?? DEFAULT_CURSORS;
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
