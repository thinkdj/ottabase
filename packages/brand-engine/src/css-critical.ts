// ---------------------------------------------------------------------------
// BrandEngine – Critical CSS for Edge/SSR (Zero FOUC)
//
// Generates :root { --var: value; } string from resolved theme.
// Injected at edge/SSR before first paint to eliminate flash of unstyled content.
// Supports dual mode (light + dark) for universal theme application before client hydration.
// ---------------------------------------------------------------------------

import type { ResolvedBrandTheme } from './resolver';
import { buildCSSVarMap } from './css-runtime';

const CRITICAL_STYLE_ID = 'brand-critical';

/**
 * Builds a CSS string for :root with all theme variables.
 * Safe for edge/SSR (no DOM). Use for HTML injection before first paint.
 */
export function buildCriticalCSS(theme: ResolvedBrandTheme): string {
    const varMap = buildCSSVarMap(theme);
    const declarations = Object.entries(varMap)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
    return `:root {\n${declarations}\n}`;
}

/**
 * Builds CSS with both light and dark palettes so theme applies universally
 * before client hydration. Uses :root for light, .dark for dark (matches next-themes).
 */
export function buildCriticalCSSDual(lightTheme: ResolvedBrandTheme, darkTheme: ResolvedBrandTheme): string {
    const lightMap = buildCSSVarMap(lightTheme);
    const lightDecl = Object.entries(lightMap)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
    const darkMap = buildCSSVarMap(darkTheme);
    const darkDecl = Object.entries(darkMap)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
    return `:root {\n${lightDecl}\n}\n.dark {\n${darkDecl}\n}`;
}

/**
 * Wraps critical CSS in a style tag for injection into HTML head.
 */
export function buildCriticalStyleTag(theme: ResolvedBrandTheme): string {
    const css = buildCriticalCSS(theme);
    return `<style id="${CRITICAL_STYLE_ID}">${css}</style>`;
}

/**
 * Wraps dual-mode critical CSS (light + dark) for universal theme application.
 * Ensures correct palette shows on first paint regardless of user's color scheme.
 */
export function buildCriticalStyleTagDual(lightTheme: ResolvedBrandTheme, darkTheme: ResolvedBrandTheme): string {
    const css = buildCriticalCSSDual(lightTheme, darkTheme);
    return `<style id="${CRITICAL_STYLE_ID}">${css}</style>`;
}

export { CRITICAL_STYLE_ID };
