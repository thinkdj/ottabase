// ---------------------------------------------------------------------------
// Brand Engine – Built-in themes (neo, crisp, default, etc.)
// Call registerBuiltInThemes() at app startup to make them available.
// ---------------------------------------------------------------------------

import type { LegacyThemeConfig } from '../adapter';
import { fromLegacyThemeConfig } from '../adapter';
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

/** Theme preset items for enhanced dropdowns (id, name, swatch colors as HSL strings) */
export const THEME_PRESET_ITEMS = BUILTIN_THEMES.map((t) => {
    const light = t.colors?.light || {};
    return {
        id: t.name,
        name: t.name.charAt(0).toUpperCase() + t.name.slice(1),
        colors: [
            light.primary || '221 83% 53%',
            light.secondary || '210 40% 96%',
            light.accent || light.primary || '221 83% 53%',
            light.muted || '210 40% 96%',
            light.destructive || '0 84% 60%',
        ] as string[],
    };
});

/** Build theme preset items from the runtime registry. Use this when THEME_PRESET_ITEMS shows stale/default colors (e.g. bundling issues). Call after registerBuiltInThemes(). */
export function getThemePresetItems(): typeof THEME_PRESET_ITEMS {
    return BUILTIN_THEME_NAMES.map((name) => {
        const theme = getThemeByName(name);
        const light = theme?.tokens?.color?.light;
        const primary = (light as Record<string, string> | undefined)?.primary || '221 83% 53%';
        return {
            id: name,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            colors: [
                primary,
                (light as Record<string, string> | undefined)?.secondary || '210 40% 96%',
                (light as Record<string, string> | undefined)?.accent || primary,
                (light as Record<string, string> | undefined)?.muted || '210 40% 96%',
                (light as Record<string, string> | undefined)?.destructive || '0 84% 60%',
            ] as string[],
        };
    });
}
