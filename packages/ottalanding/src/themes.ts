/**
 * Landing themes — complete visual layers over the same content.
 *
 * Each theme pairs a Brand Engine preset (colors, fonts, radius) with its own
 * layout and section designs (in `@ottabase/ottalanding/react`). Switching theme
 * never touches content.
 */

import { buildCSSVarMap, getThemeByName, registerBuiltInThemes, resolveTheme } from '@ottabase/brand-engine';

export const THEMES = [
    {
        id: 'launch',
        label: 'Launch',
        description: 'Modern SaaS. Sticky top nav, centered hero, card grids.',
        preset: 'neo',
        scheme: 'light',
    },
    {
        id: 'editorial',
        label: 'Editorial',
        description: 'Magazine serif. Side navigation, left-aligned type, numbered features.',
        preset: 'rose',
        scheme: 'light',
    },
    {
        id: 'bold',
        label: 'Bold',
        description: 'Dark and loud. Oversized type, logo ticker, bento features.',
        preset: 'midnight',
        scheme: 'dark',
    },
] as const;

export type LandingTheme = (typeof THEMES)[number];
export type ThemeId = LandingTheme['id'];

export function getTheme(id: string): LandingTheme {
    return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export type ColorScheme = 'light' | 'dark';

/**
 * The theme's design tokens for both color schemes, plus the font stylesheets it needs.
 *
 * `selector` gets the theme's default scheme; `selector[data-scheme="light|dark"]` pins
 * either one (the visitor's toggle sets that attribute). Use `:root` for the live site and
 * a scoping selector for previews.
 */
export function themeStyles(id: string, selector = ':root'): { css: string; fonts: string[] } {
    const theme = getTheme(id);
    registerBuiltInThemes();
    const base = getThemeByName(theme.preset);
    if (!base) return { css: '', fonts: [] };

    const fonts = new Set<string>();
    const rule = (mode: ColorScheme, selectors: string) => {
        const resolved = resolveTheme({ base, tenantOverrides: {}, mode });
        for (const role of Object.values(resolved.typography ?? {})) if (role?.url) fonts.add(role.url);
        const declarations = Object.entries(buildCSSVarMap(resolved, mode))
            .map(([prop, value]) => `${prop}:${value}`)
            .join(';');
        return `${selectors}{color-scheme:${mode};${declarations}}`;
    };
    const other: ColorScheme = theme.scheme === 'dark' ? 'light' : 'dark';
    const css =
        rule(theme.scheme, `${selector},${selector}[data-scheme="${theme.scheme}"]`) +
        rule(other, `${selector}[data-scheme="${other}"]`);
    return { css, fonts: [...fonts] };
}
