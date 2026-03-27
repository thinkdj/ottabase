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
import { DEFAULT_TYPOGRAPHY } from './defaults';
import type { ResolvedBrandTheme } from './resolver';
import type { TokenColors } from './tokens';

// ---------------------------------------------------------------------------
// Typography weight: semantic keywords → numeric CSS values
// ---------------------------------------------------------------------------

const FONT_WEIGHT_MAP: Record<string, string> = {
    normal: '400',
    bold: '700',
    medium: '500',
    semibold: '600',
    black: '900',
    '100': '100',
    '200': '200',
    '300': '300',
    '400': '400',
    '500': '500',
    '600': '600',
    '700': '700',
    '800': '800',
    '900': '900',
};

function toCssFontWeight(val: string | number | undefined): string {
    if (val === undefined || val === null) return '400';
    const s = String(val).toLowerCase();
    return FONT_WEIGHT_MAP[s] ?? (Number.isNaN(Number(s)) ? '400' : s);
}

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

    // -- Typography (defensive: typography can be undefined after clean reset) ---
    const typo = theme.typography ?? DEFAULT_TYPOGRAPHY;
    vars['--font-heading'] = `"${typo.heading?.fontFamily ?? 'Inter'}", sans-serif`;
    vars['--font-body'] = `"${typo.body?.fontFamily ?? 'Inter'}", sans-serif`;
    vars['--font-handwriting'] = `"${typo.handwriting?.fontFamily ?? 'cursive'}", cursive`;

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

    // -- Typography extended properties (weight, line-height, letter-spacing) ---
    vars['--typography-heading-weight'] = toCssFontWeight(typo.heading?.fontWeight ?? 700);
    vars['--typography-heading-line-height'] = typo.heading?.lineHeight ?? '1.2';
    vars['--typography-heading-spacing'] = typo.heading?.letterSpacing ?? 'normal';
    vars['--typography-body-weight'] = toCssFontWeight(typo.body?.fontWeight ?? 400);
    vars['--typography-body-line-height'] = typo.body?.lineHeight ?? '1.5';
    vars['--typography-body-spacing'] = typo.body?.letterSpacing ?? 'normal';

    // -- Motion / transition presets -----------------------------------------
    // When disableAnimations: true, set durations to 0s (simpler than data-attr + global CSS)
    const noMotion = theme.motion.disableAnimations;
    vars['--duration-fast'] = noMotion ? '0s' : theme.motion.durationFast;
    vars['--duration-normal'] = noMotion ? '0s' : theme.motion.durationNormal;
    vars['--duration-slow'] = noMotion ? '0s' : theme.motion.durationSlow;
    vars['--ease'] = theme.motion.easing;
    vars['--ease-enter'] = theme.motion.easingEnter;
    vars['--ease-exit'] = theme.motion.easingExit;
    // Semantic --motion-* aliases match the component-level convention
    vars['--motion-duration-fast'] = noMotion ? '0s' : theme.motion.durationFast;
    vars['--motion-duration-normal'] = noMotion ? '0s' : theme.motion.durationNormal;
    vars['--motion-duration-slow'] = noMotion ? '0s' : theme.motion.durationSlow;
    vars['--motion-ease-default'] = theme.motion.easing;
    vars['--motion-ease-enter'] = theme.motion.easingEnter;
    vars['--motion-ease-exit'] = theme.motion.easingExit;
    // Bouncy is a fixed preset easing curve (not brand-configurable)
    vars['--motion-ease-bouncy'] = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

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
 * When motion.disableAnimations is true, duration vars are set to 0s in buildCSSVarMap.
 */
export function applyBrandTheme(theme: ResolvedBrandTheme): void {
    if (typeof document === 'undefined') return; // SSR guard

    // Inject fonts (typography can be undefined after clean reset)
    const typo = theme.typography ?? DEFAULT_TYPOGRAPHY;
    const fontUrls = new Set([typo.heading?.url, typo.body?.url, typo.handwriting?.url].filter(Boolean) as string[]);
    fontUrls.forEach(injectFont);

    // Build & inject CSS vars (disableAnimations → duration vars become 0s)
    const varMap = buildCSSVarMap(theme);
    injectCSSVars(document.documentElement.style, varMap);
}
