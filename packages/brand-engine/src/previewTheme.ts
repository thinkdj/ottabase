// ---------------------------------------------------------------------------
// Brand Engine – Client-side preview theme builder
// Builds ResolvedBrandTheme from BrandKitItem-like data for realtime admin preview
// Works with preset-as-template architecture (no registry needed)
// ---------------------------------------------------------------------------

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
import type { ResolvedBrandTheme } from './resolver';
import type { DesignTokens, ModeValue, TokenColors } from './tokens';

/**
 * Extracts the mode-specific value from a ModeValue token.
 * Falls back to `light` or the value itself if not split by mode.
 */
function extractMode<T>(val: ModeValue<T> | undefined, mode: string, isBase: (v: unknown) => boolean): T | undefined {
    if (val === undefined || val === null) return undefined;
    if (isBase(val)) return val as T;
    const split = val as { [k: string]: T | undefined };
    return split[mode] ?? split['light'];
}

const isStringMap = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && Object.values(v as object).every((x) => typeof x === 'string');

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

    // Get mode-specific colors from tokensJson
    const defaultPalette = mode === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
    const rawPalette = tokens.color?.[mode] ?? tokens.color?.light ?? defaultPalette;
    const colors = { ...defaultPalette, ...rawPalette } as TokenColors;

    // Extract other design tokens with defaults, resolving ModeValue split (light/dark)
    const rawTypoFull = tokens.typography;
    const rawTypo = extractMode(
        rawTypoFull,
        mode,
        (v: unknown) => typeof v === 'object' && v !== null && ('heading' in (v as object) || 'body' in (v as object)),
    );
    const typography = {
        heading: { ...DEFAULT_TYPOGRAPHY.heading, ...rawTypo?.heading },
        body: { ...DEFAULT_TYPOGRAPHY.body, ...rawTypo?.body },
        handwriting: { ...DEFAULT_TYPOGRAPHY.handwriting, ...rawTypo?.handwriting },
    };

    const rawSpacing = extractMode(tokens.spacing, mode, isStringMap);
    const spacing = { ...DEFAULT_SPACING, ...(rawSpacing ?? {}) };

    const rawRadius = extractMode(tokens.radius, mode, (v) => typeof v === 'string');
    const radius = rawRadius ?? '0.5rem';

    const rawShadows = extractMode(tokens.shadow, mode, isStringMap);
    const shadows = { ...DEFAULT_SHADOWS, ...(rawShadows ?? {}) };

    const rawMotion = extractMode(tokens.motion, mode, isStringMap);
    const motion = { ...DEFAULT_MOTION, ...(rawMotion ?? {}) };

    // Resolve cursors: prefer parsed cursors from tokensJson, then resolve for mode if split
    const resolvedCursors = parsedCursors
        ? (extractMode(parsedCursors as ModeValue<Record<string, string>>, mode, isStringMap) ?? parsedCursors)
        : DEFAULT_CURSORS;

    return {
        name: kitData.themePresetId || 'custom',
        colors,
        typography,
        spacing,
        radius,
        shadows,
        motion,
        cursors: resolvedCursors,
        layout: DEFAULT_LAYOUT,
    };
}
