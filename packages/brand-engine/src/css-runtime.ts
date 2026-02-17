// ---------------------------------------------------------------------------
// BrandEngine – CSS Variable Runtime
//
// Converts resolved tokens into CSS custom properties and injects them into
// the document root (or a supplied element).
//
// Output variables follow the convention consumed by Tailwind + shadcn:
//   --primary, --background, --font-heading, --shadow-lg, --duration-fast, …
//
// This module is intentionally side-effect-free in Node (no global DOM access).
// The `injectCSSVars` function operates on a supplied `CSSStyleDeclaration`.
// The `applyBrandTheme` convenience function targets `document.documentElement`.
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { resolveCursor } from './cursors';
import type { ResolvedBrandTheme } from './resolver';
import type { TokenColors } from './tokens';

// ---------------------------------------------------------------------------
// Pure token → CSS-var map builder (no DOM dependency)
// ---------------------------------------------------------------------------

/**
 * Builds a flat `Record<string, string>` mapping CSS custom-property names
 * to their values from a resolved theme.
 *
 * Useful for SSR, testing, or injecting into non-DOM targets.
 */
export function buildCSSVarMap(theme: ResolvedBrandTheme): Record<string, string> {
    const vars: Record<string, string> = {};

    // -- Typography ----------------------------------------------------------
    // -- Typography ----------------------------------------------------------
    vars['--font-heading'] = `"${theme.typography.heading.fontFamily}", sans-serif`;
    vars['--font-body'] = `"${theme.typography.body.fontFamily}", sans-serif`;
    vars['--font-handwriting'] = `"${theme.typography.handwriting.fontFamily}", cursive`;

    // -- Colour tokens -------------------------------------------------------
    for (const [token, hslValue] of Object.entries(theme.colors as TokenColors)) {
        if (hslValue !== undefined) {
            vars[`--${token}`] = hslValue;
        }
    }

    // -- Border radius -------------------------------------------------------
    vars['--radius'] = theme.radius;

    // -- Spacing -------------------------------------------------------------
    if (theme.spacing) {
        for (const [key, val] of Object.entries(theme.spacing)) {
            vars[`--spacing-${key}`] = val;
        }
    }

    // -- Shadow elevation scale ----------------------------------------------
    for (const [level, val] of Object.entries(theme.shadows)) {
        vars[`--shadow-${level}`] = val;
    }

    // -- Motion / transition presets -----------------------------------------
    vars['--duration-fast'] = theme.motion.durationFast;
    vars['--duration-normal'] = theme.motion.durationNormal;
    vars['--duration-slow'] = theme.motion.durationSlow;
    vars['--ease'] = theme.motion.easing;
    vars['--ease-enter'] = theme.motion.easingEnter;
    vars['--ease-exit'] = theme.motion.easingExit;

    // -- Layout tokens (as CSS vars for component contracts) -----------------
    applyLayoutVars(vars, theme.layout);

    // -- Cursors (registry:, svg:, url() resolved to data URIs) --------------
    if (theme.cursors) {
        for (const [state, raw] of Object.entries(theme.cursors)) {
            if (raw !== undefined) {
                vars[`--cursor-${state}`] = resolveCursor(raw);
            }
        }
    }

    return vars;
}

/**
 * Maps layout config values to CSS custom properties.
 */
function applyLayoutVars(vars: Record<string, string>, layout: LayoutConfig): void {
    vars['--layout-header'] = layout.header;
    vars['--layout-navigation'] = layout.navigation;
    vars['--layout-content-width'] = layout.contentWidth;
    vars['--layout-footer'] = layout.footer ? '1' : '0';
    vars['--layout-density'] = layout.density;
}

// ---------------------------------------------------------------------------
// DOM injection helpers
// ---------------------------------------------------------------------------

/**
 * Writes all CSS custom properties from `varMap` onto the supplied style target.
 */
export function injectCSSVars(
    style: { setProperty(prop: string, val: string): void },
    varMap: Record<string, string>,
): void {
    for (const [prop, val] of Object.entries(varMap)) {
        style.setProperty(prop, val);
    }
}

/** Set of font URLs already injected to avoid duplicate <link> tags */
const injectedFontUrls = new Set<string>();

/**
 * Injects a Google Fonts (or any external) stylesheet link into <head>.
 * Deduplicates by URL.
 */
export function injectFont(url: string): void {
    if (typeof document === 'undefined') return; // SSR guard
    if (injectedFontUrls.has(url)) return;

    // Check if the font is already in the DOM (iterating to avoid unsafe selector)
    const links = document.getElementsByTagName('link');
    for (let i = 0; i < links.length; i++) {
        if (links[i].href === url && links[i].rel === 'stylesheet') {
            injectedFontUrls.add(url);
            return;
        }
    }

    const linkEl = document.createElement('link');
    linkEl.href = url;
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);
    injectedFontUrls.add(url);
}

/**
 * Convenience function: resolves a theme and applies all CSS vars + fonts
 * to `document.documentElement`.
 *
 * This is the main runtime entry point for browser environments.
 */
export function applyBrandTheme(theme: ResolvedBrandTheme): void {
    if (typeof document === 'undefined') return; // SSR guard

    // Inject fonts
    const fontUrls = new Set(
        [theme.typography.heading.url, theme.typography.body.url, theme.typography.handwriting.url].filter(
            Boolean,
        ) as string[],
    );
    fontUrls.forEach(injectFont);

    // Build & inject CSS vars
    const varMap = buildCSSVarMap(theme);
    injectCSSVars(document.documentElement.style, varMap);
}
