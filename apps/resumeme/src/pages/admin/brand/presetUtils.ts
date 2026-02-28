/**
 * Utilities for preset expansion in Brand Kit admin UI.
 * Keeps cursor preservation logic in one place for consistency with API handler.
 */

export interface ApiPresetShape {
    name: string;
    colors: { light: Record<string, string>; dark: Record<string, string> };
    typography?: unknown;
    spacing?: unknown;
    radius?: unknown;
    shadows?: unknown;
    motion?: unknown;
    cursors?: Record<string, string>;
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

    return {
        color: {
            light: { ...preset.colors.light },
            dark: { ...preset.colors.dark },
        },
        typography: preset.typography ?? undefined,
        spacing: preset.spacing ?? undefined,
        radius: preset.radius ?? '0.5rem',
        shadow: preset.shadows ?? undefined,
        motion: preset.motion ?? undefined,
        ...(effectiveCursors !== undefined && { cursors: effectiveCursors }),
    };
}
