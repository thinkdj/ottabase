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
const INITIAL_CONFIG_ELEMENT_ID = 'brand-initial-config';

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

// Matches '<', '>', '&', and the two JSON-legal-but-JS-string-illegal line
// terminators (U+2028, U+2029), referenced by code point to avoid embedding
// invisible characters in this source file.
const UNSAFE_INLINE_SCRIPT_CHARS = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

const INLINE_SCRIPT_ESCAPES: Record<string, string> = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    [String.fromCharCode(0x2028)]: '\\u2028',
    [String.fromCharCode(0x2029)]: '\\u2029',
};

/**
 * Escapes a JSON string for safe embedding inside an inline <script> tag:
 * prevents premature tag closure (and script injection) if a string value
 * contains "</script>", and escapes U+2028/U+2029 which are valid in JSON
 * but illegal unescaped in JS string literals in some engines.
 */
function escapeJsonForInlineScript(json: string): string {
    return json.replace(UNSAFE_INLINE_SCRIPT_CHARS, (ch) => INLINE_SCRIPT_ESCAPES[ch] ?? ch);
}

/**
 * Wraps the resolved brand config in a JSON <script> tag so the client can
 * hydrate synchronously from what the edge already resolved, instead of
 * re-fetching /api/brand on mount (zero-FOUC handoff, no redundant round-trip).
 */
export function buildInitialConfigScriptTag(config: unknown): string {
    const json = escapeJsonForInlineScript(JSON.stringify(config));
    return `<script type="application/json" id="${INITIAL_CONFIG_ELEMENT_ID}">${json}</script>`;
}

export { CRITICAL_STYLE_ID, INITIAL_CONFIG_ELEMENT_ID };
