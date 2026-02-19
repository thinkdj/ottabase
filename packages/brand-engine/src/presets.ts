// ---------------------------------------------------------------------------
// Brand Engine – Theme Presets (Shared)
// Single source of truth for all theme presets
// ---------------------------------------------------------------------------

import artisanTheme from './themes/artisan.json';
import crispTheme from './themes/crisp.json';
import defaultTheme from './themes/default.json';
import funkyTheme from './themes/funky.json';
import midnightTheme from './themes/midnight.json';
import neoTheme from './themes/neo.json';
import roseTheme from './themes/rose.json';
import verdantTheme from './themes/verdant.json';

export type PresetTheme = {
    name: string;
    colors: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
    typography?: unknown;
    spacing?: unknown;
    radius?: unknown;
    shadows?: unknown;
    motion?: unknown;
};

/** Array of all available theme presets (for API responses) */
export const PRESET_THEMES: PresetTheme[] = [
    defaultTheme as PresetTheme,
    neoTheme as PresetTheme,
    crispTheme as PresetTheme,
    funkyTheme as PresetTheme,
    artisanTheme as PresetTheme,
    midnightTheme as PresetTheme,
    roseTheme as PresetTheme,
    verdantTheme as PresetTheme,
];

/** Map of theme presets by name (for lookup during expansion) */
export const PRESET_MAP: Record<string, PresetTheme> = {
    default: defaultTheme as PresetTheme,
    neo: neoTheme as PresetTheme,
    crisp: crispTheme as PresetTheme,
    funky: funkyTheme as PresetTheme,
    artisan: artisanTheme as PresetTheme,
    midnight: midnightTheme as PresetTheme,
    rose: roseTheme as PresetTheme,
    verdant: verdantTheme as PresetTheme,
};
