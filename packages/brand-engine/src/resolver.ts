// ---------------------------------------------------------------------------
// BrandEngine – Theme Resolver
//
// Implements the merge layer:
//   finalTheme = baseTheme + tenantOverrides + modeOverrides (dark/light)
//
// Per-category resolution lives in resolve-core.ts (shared with the BrandKit
// persistence pipeline and the admin preview builder — one implementation,
// three entry points).
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { DEFAULT_LAYOUT } from '@ottabase/ottalayout';
import { DEFAULT_CURSORS } from './defaults';
import { isPlainObject, pickMode, resolveAliases, resolveTokenSet } from './resolve-core';
import type { ResolvedTokenSet } from './resolve-core';
import type { BrandTheme } from './theme';
import type { ColorScheme, ModeValue, TokenCursors } from './tokens';

export { resolveAliases };

// ---------------------------------------------------------------------------
// Deep-merge utility
// ---------------------------------------------------------------------------

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
// Mode extraction utility (kept for external callers; delegates to core)
// ---------------------------------------------------------------------------

/**
 * Safely extracts the value for the active mode from a ModeValue token.
 * The `isBase` predicate is retained for signature compatibility but split
 * detection now uses the robust light/dark-key check from resolve-core.
 */
export function resolveModeValue<T>(
    val: ModeValue<T> | undefined,
    mode: ColorScheme,
    _isBase?: (v: unknown) => boolean,
): T | undefined {
    return pickMode(val, mode);
}

// ---------------------------------------------------------------------------
// ResolvedBrandTheme – the fully-flattened output of the resolver
// ---------------------------------------------------------------------------

/**
 * Resolved theme ready for CSS variable injection. This is the wire shape:
 * it flows through the KV cache, the edge hydration payload and the client.
 * Sparse v2 categories (palette, typeScale, focus, …) are present only when
 * the theme defines them — see ResolvedTokenSet.
 */
export interface ResolvedBrandTheme extends ResolvedTokenSet {
    name: string;
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

    // 2. Resolve every token category for the active mode (shared core)
    const tokenSet = resolveTokenSet(merged.tokens, mode);

    // 3. Cursors + layout live outside DesignTokens
    const cursors = pickMode(merged.cursors, mode) ?? DEFAULT_CURSORS;
    const layout = { ...DEFAULT_LAYOUT, ...merged.layout };

    return {
        name: merged.name,
        ...tokenSet,
        cursors,
        layout,
    };
}
