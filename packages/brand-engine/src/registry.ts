// ---------------------------------------------------------------------------
// BrandEngine – Theme Registry
//
// A simple runtime catalogue of BrandThemes. Apps register themes at startup
// and look them up by name.
// ---------------------------------------------------------------------------

import type { BrandTheme } from './theme';

const registry = new Map<string, BrandTheme>();

/** Register one or more themes. Duplicate names overwrite the previous entry. */
export function registerThemes(themes: BrandTheme[]): void {
    for (const t of themes) {
        registry.set(t.name, t);
    }
}

/** Register a single theme */
export function registerTheme(theme: BrandTheme): void {
    registry.set(theme.name, theme);
}

/** Retrieve a theme by name, or `undefined` if not registered. */
export function getThemeByName(name: string): BrandTheme | undefined {
    return registry.get(name);
}

/** Retrieve a theme by name with fallback to a named default (or first registered). */
export function getThemeOrDefault(name: string, fallbackName = 'default'): BrandTheme {
    const theme = registry.get(name) ?? registry.get(fallbackName) ?? [...registry.values()][0];
    if (!theme) {
        throw new Error(
            `[BrandEngine] No theme found for "${name}" and no fallback registered. ` +
                'Call registerThemes() before using getThemeOrDefault().',
        );
    }
    return theme;
}

/** List all registered theme names. */
export function getRegisteredThemeNames(): string[] {
    return [...registry.keys()];
}

/** Clear the entire registry (useful for tests). */
export function clearThemeRegistry(): void {
    registry.clear();
}
