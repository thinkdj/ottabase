// ---------------------------------------------------------------------------
// BrandEngine – Critical CSS for Edge/SSR (Zero FOUC)
//
// Generates :root { --var: value; } string from resolved theme.
// Injected at edge/SSR before first paint to eliminate flash of unstyled content.
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
 * Wraps critical CSS in a style tag for injection into HTML head.
 */
export function buildCriticalStyleTag(theme: ResolvedBrandTheme): string {
    const css = buildCriticalCSS(theme);
    return `<style id="${CRITICAL_STYLE_ID}">${css}</style>`;
}

export { CRITICAL_STYLE_ID };
