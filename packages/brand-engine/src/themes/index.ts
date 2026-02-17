// ---------------------------------------------------------------------------
// Brand Engine – Built-in themes (default, neo, crisp, funky, artisan, midnight, rose, verdant)
// Call registerBuiltInThemes() at app startup to make them available.
// ---------------------------------------------------------------------------

import type { LegacyThemeConfig } from '../adapter';
import { fromLegacyThemeConfig } from '../adapter';
import { DEFAULT_COLORS_LIGHT } from '../defaults';
import { getThemeByName, registerThemes } from '../registry';

import defaultTheme from './default.json';
import neoTheme from './neo.json';
import crispTheme from './crisp.json';
import funkyTheme from './funky.json';
import artisanTheme from './artisan.json';
import midnightTheme from './midnight.json';
import roseTheme from './rose.json';
import verdantTheme from './verdant.json';

const BUILTIN_THEMES: LegacyThemeConfig[] = [
    defaultTheme as LegacyThemeConfig,
    neoTheme as LegacyThemeConfig,
    crispTheme as LegacyThemeConfig,
    funkyTheme as LegacyThemeConfig,
    artisanTheme as LegacyThemeConfig,
    midnightTheme as LegacyThemeConfig,
    roseTheme as LegacyThemeConfig,
    verdantTheme as LegacyThemeConfig,
];

/** Register all built-in themes (default, neo, crisp, funky, artisan, midnight, rose, verdant) */
export function registerBuiltInThemes(): void {
    const brandThemes = BUILTIN_THEMES.map(fromLegacyThemeConfig);
    registerThemes(brandThemes);
}

/** Names of built-in themes */
export const BUILTIN_THEME_NAMES = BUILTIN_THEMES.map((t) => t.name);

export type ThemePresetItem = {
    id: string;
    name: string;
    colors: [string, string, string, string, string];
};

/** Shared fallback colors aligned with defaults */
const FALLBACK = {
    primary: DEFAULT_COLORS_LIGHT.primary,
    secondary: DEFAULT_COLORS_LIGHT.secondary,
    accent: DEFAULT_COLORS_LIGHT.accent,
    muted: DEFAULT_COLORS_LIGHT.muted,
    destructive: DEFAULT_COLORS_LIGHT.destructive,
};

/** Build a single preset item from theme name and light color tokens */
function toPresetItem(name: string, light: Record<string, string> | undefined): ThemePresetItem {
    const primary = light?.primary || FALLBACK.primary;
    return {
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        colors: [
            primary,
            light?.secondary || FALLBACK.secondary,
            light?.accent || primary,
            light?.muted || FALLBACK.muted,
            light?.destructive || FALLBACK.destructive,
        ],
    };
}

/** Theme preset items from JSON (static fallback). Prefer getThemePresetItems() when registry is ready. */
export const THEME_PRESET_ITEMS: ThemePresetItem[] = BUILTIN_THEMES.map((t) => toPresetItem(t.name, t.colors?.light));

/** Build theme preset items from the runtime registry. Use for admin UI to get accurate swatch colors. Call after registerBuiltInThemes(). */
export function getThemePresetItems(): ThemePresetItem[] {
    return BUILTIN_THEME_NAMES.map((name) => {
        const theme = getThemeByName(name);
        const light = theme?.tokens?.color?.light as Record<string, string> | undefined;
        return toPresetItem(name, light);
    });
}
