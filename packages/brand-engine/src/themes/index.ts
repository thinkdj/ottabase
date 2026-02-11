// ---------------------------------------------------------------------------
// Brand Engine – Built-in themes (neo, crisp, default, etc.)
// Call registerBuiltInThemes() at app startup to make them available.
// ---------------------------------------------------------------------------

import type { LegacyThemeConfig } from '../adapter';
import { fromLegacyThemeConfig } from '../adapter';
import { registerThemes } from '../registry';

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
