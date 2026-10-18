/**
 * Utilities for preset expansion in Brand Kit admin UI.
 * Mirrors the API handler (expandPresetToTokens): every token category the
 * engine knows passes through, so a preset's v2 categories (selection, links,
 * native, scopes, …) survive a client-side apply exactly as they do on save.
 */

import { TOKEN_CATEGORY_KEYS } from '@ottabase/brand-engine';

export interface ApiPresetShape {
    name: string;
    colors: { light: Record<string, string>; dark: Record<string, string> };
    typography?: unknown;
    spacing?: unknown;
    radius?: unknown;
    shadows?: unknown;
    motion?: unknown;
    cursors?: Record<string, string>;
    [category: string]: unknown;
}

/**
 * Build expanded tokens from API preset.
 * Cursors: user-configured take precedence; fall back to preset cursors (e.g. artisan/funky registry cursors).
 */
export function expandPresetPreservingCursors(
    preset: ApiPresetShape,
    currentTokensJson: string | null | undefined,
): Record<string, unknown> {
    const current = (() => {
        try {
            return JSON.parse(currentTokensJson || '{}') as Record<string, unknown>;
        } catch {
            return {};
        }
    })();

    const effectiveCursors = current.cursors ?? preset.cursors;

    const expanded: Record<string, unknown> = {
        color: {
            light: { ...preset.colors.light },
            dark: { ...preset.colors.dark },
        },
        ...(effectiveCursors !== undefined && { cursors: effectiveCursors }),
    };
    for (const key of TOKEN_CATEGORY_KEYS) {
        if (key === 'color') continue;
        const val = key === 'shadow' ? preset.shadows : preset[key];
        if (val !== undefined) expanded[key] = val;
    }
    expanded.radius ??= '0.5rem';
    return expanded;
}
