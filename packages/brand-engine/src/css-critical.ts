// ---------------------------------------------------------------------------
// BrandEngine – Critical CSS for Edge/SSR (Zero FOUC)
//
// Generates :root { --var: value; } string from resolved theme.
// Injected at edge/SSR before first paint to eliminate flash of unstyled content.
// Supports dual mode (light + dark) for universal theme application before client hydration.
// ---------------------------------------------------------------------------

import type { ResolvedBrandTheme } from './resolver';
import { buildBrandStylesheet } from './css-runtime';
import { buildEffectsCSS } from './effects';

const CRITICAL_STYLE_ID = 'brand-critical';
const EFFECTS_STYLE_ID = 'brand-effects';
const CUSTOM_CSS_STYLE_ID = 'brand-custom-css';
const INITIAL_CONFIG_ELEMENT_ID = 'brand-initial-config';

/**
 * Builds a CSS string for :root with all theme variables (+ scope rooms).
 * Safe for edge/SSR (no DOM). Use for HTML injection before first paint.
 */
export function buildCriticalCSS(theme: ResolvedBrandTheme): string {
    return buildBrandStylesheet(theme);
}

/**
 * Builds CSS with both light and dark palettes so theme applies universally
 * before client hydration. Uses :root for light, .dark for dark (matches
 * next-themes), plus `[data-brand-scope]` room blocks.
 */
export function buildCriticalCSSDual(lightTheme: ResolvedBrandTheme, darkTheme: ResolvedBrandTheme): string {
    return buildBrandStylesheet(lightTheme, darkTheme);
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
 * Pass `sanitize` (e.g. sanitizeCssForStyleTag) when injecting into raw HTML —
 * v2 token values (palette, shadows, links colors) are admin-authored free-form
 * strings, so the tag must be breakout-proofed like effects/custom CSS.
 * (The client path is immune: upsertStyleElement assigns textContent.)
 */
export function buildCriticalStyleTagDual(
    lightTheme: ResolvedBrandTheme,
    darkTheme: ResolvedBrandTheme,
    sanitize?: (css: string) => string,
): string {
    let css = buildCriticalCSSDual(lightTheme, darkTheme);
    if (sanitize) css = sanitize(css);
    return `<style id="${CRITICAL_STYLE_ID}">${css}</style>`;
}

/**
 * Wraps the generated effects stylesheet (@font-face, @keyframes, text-style
 * voices, link contract, effect utilities, theme css) for edge injection.
 * Returns '' when the theme uses none of the generative categories.
 * Pass `sanitize` (e.g. sanitizeCssForStyleTag) when injecting into raw HTML —
 * effects.css is theme-authored and could otherwise close the style tag.
 */
export function buildEffectsStyleTag(theme: ResolvedBrandTheme, sanitize?: (css: string) => string): string {
    let css = buildEffectsCSS(theme);
    if (css && sanitize) css = sanitize(css);
    return css ? `<style id="${EFFECTS_STYLE_ID}">${css}</style>` : '';
}

/**
 * Wraps per-kit custom CSS for edge injection (zero-FOUC path for the raw
 * escape hatch). The caller is responsible for sanitizing tenant-authored CSS
 * (sanitizeCssForStyleTag) BEFORE calling. Returns '' for empty CSS.
 */
export function buildCustomCssStyleTag(sanitizedCss: string | null | undefined): string {
    if (!sanitizedCss || !sanitizedCss.trim()) return '';
    return `<style id="${CUSTOM_CSS_STYLE_ID}">${sanitizedCss}</style>`;
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

export { CRITICAL_STYLE_ID, CUSTOM_CSS_STYLE_ID, EFFECTS_STYLE_ID, INITIAL_CONFIG_ELEMENT_ID };
