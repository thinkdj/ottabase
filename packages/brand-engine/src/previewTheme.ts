// ---------------------------------------------------------------------------
// Brand Engine – Client-side preview theme builder
// Builds ResolvedBrandTheme from BrandKitItem-like data for realtime admin preview
// Works with preset-as-template architecture (no registry needed).
// Per-category resolution delegates to resolve-core.ts (shared with
// resolver.ts and the BrandKit persistence pipeline).
// ---------------------------------------------------------------------------

import { DEFAULT_LAYOUT } from '@ottabase/ottalayout';
import { DEFAULT_CURSORS } from './defaults';
import { pickMode, resolveTokenSet } from './resolve-core';
import type { ResolvedBrandTheme } from './resolver';
import type { DesignTokens, ModeValue } from './tokens';

export interface PreviewKitData {
    tokensJson?: string | null;
    themePresetId?: string | null;
}

/**
 * Build ResolvedBrandTheme from kit data (tokensJson).
 * Used for realtime preview in admin UI before saving.
 *
 * With preset-as-template architecture, tokensJson contains the complete expanded theme,
 * so we just read it directly (no registry lookups needed).
 */
export function buildPreviewTheme(kitData: PreviewKitData, mode: string = 'light'): ResolvedBrandTheme {
    let tokens: Partial<DesignTokens> = {};
    let parsedCursors: Record<string, string> | undefined;

    // Parse tokensJson (contains expanded theme if preset was selected)
    if (kitData.tokensJson) {
        try {
            const parsed = JSON.parse(kitData.tokensJson) as Record<string, unknown>;
            // Extract cursors separately – they live at root of tokensJson, not inside DesignTokens
            const { cursors, colors: legacyColors, ...tokenRest } = parsed;
            tokens = { ...tokenRest } as Partial<DesignTokens>;

            if (cursors && typeof cursors === 'object') {
                parsedCursors = cursors as Record<string, string>;
            }

            // Handle legacy colors -> color migration
            if (legacyColors && typeof legacyColors === 'object' && !tokens.color) {
                tokens.color = legacyColors as DesignTokens['color'];
            }
        } catch {
            // If parsing fails, use defaults
            tokens = {};
        }
    }

    // Resolve every token category for the requested mode (shared core)
    const tokenSet = resolveTokenSet(tokens, mode);

    // Resolve cursors: prefer parsed cursors from tokensJson, resolving mode split if present
    const resolvedCursors = parsedCursors
        ? (pickMode(parsedCursors as ModeValue<Record<string, string>>, mode) ?? parsedCursors)
        : DEFAULT_CURSORS;

    return {
        name: kitData.themePresetId || 'custom',
        ...tokenSet,
        cursors: resolvedCursors,
        layout: DEFAULT_LAYOUT,
    };
}
