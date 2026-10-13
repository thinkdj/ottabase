// ---------------------------------------------------------------------------
// BrandEngine – CSS Variable Runtime
//
// Converts resolved tokens into CSS custom properties and injects them into
// the document as a stylesheet.
//
// Output variables follow the convention consumed by Tailwind + shadcn:
//   --primary, --background, --font-heading, --shadow-lg, --duration-fast, …
// v2 sparse categories add: --{palette-name}, --text-{step}, --radius-{size},
//   --border-width, --focus-ring-*, --hover-*/--press-*, --link-*,
//   --selection-*, --scrollbar-*, --accent-color, --z-{name}, --bg-backdrop.
//
// This module is intentionally side-effect-free in Node (no global DOM access).
// `applyBrandTheme` (browser) writes/replaces <style id="brand-critical"> and
// <style id="brand-effects"> — the same elements the edge injects — so the
// `.dark` cascade keeps working (no inline-style specificity wars).
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { resolveCursor } from './cursors';
import { DEFAULT_TYPOGRAPHY } from './defaults';
import { buildScopesCSS } from './effects';
import {
    emitBorderVars,
    emitColorVars,
    emitFocusVars,
    emitInteractionVars,
    emitLinksVars,
    emitNativeVars,
    emitPaletteVars,
    emitRadiusVars,
    emitScrollbarVars,
    emitSelectionVars,
    emitShadowVars,
    emitSurfaceVars,
    emitTypeScaleVars,
    emitZIndexVars,
    fontGenericFallback,
    toCssFontWeight,
    varMapToDeclarations,
} from './emit-vars';
import type { ResolvedBrandTheme } from './resolver';
import type { ColorScheme, TokenTypographyRoles } from './tokens';

export { varMapToDeclarations } from './emit-vars';

// ---------------------------------------------------------------------------
// Pure token → CSS-var map builder (no DOM dependency)
// ---------------------------------------------------------------------------

/**
 * Builds a flat `Record<string, string>` mapping CSS custom-property names
 * to their values from a resolved theme.
 *
 * `mode` matters only for mode-polar declarations (native color-scheme).
 * Useful for SSR, testing, or injecting into non-DOM targets.
 */
export function buildCSSVarMap(theme: ResolvedBrandTheme, mode: ColorScheme = 'light'): Record<string, string> {
    const vars: Record<string, string> = {};

    // -- Typography roles (defensive: typography can be undefined after clean reset) ---
    const typo: TokenTypographyRoles = theme.typography ?? DEFAULT_TYPOGRAPHY;
    for (const [role, settings] of Object.entries(typo)) {
        if (!settings?.fontFamily) continue;
        // A comma means the theme authored a full stack — emit verbatim;
        // otherwise quote the single family and append a generic fallback.
        vars[`--font-${role}`] = settings.fontFamily.includes(',')
            ? settings.fontFamily
            : `"${settings.fontFamily}", ${fontGenericFallback(role)}`;
    }
    // Guarantee the core roles even on malformed data
    vars['--font-heading'] ??= '"Inter", sans-serif';
    vars['--font-body'] ??= '"Inter", sans-serif';
    vars['--font-handwriting'] ??= '"cursive", cursive';
    vars['--font-mono'] ??= '"JetBrains Mono", monospace';

    // -- Typography extended properties (weight, line-height, letter-spacing) ---
    // heading/body keep their historical defaults; other roles default neutrally.
    for (const [role, settings] of Object.entries(typo)) {
        if (!settings) continue;
        const defaultWeight = role === 'heading' ? '700' : '400';
        const defaultLh = role === 'heading' ? '1.2' : role === 'body' ? '1.5' : 'normal';
        vars[`--typography-${role}-weight`] = toCssFontWeight(settings.fontWeight, defaultWeight);
        vars[`--typography-${role}-line-height`] = settings.lineHeight ?? defaultLh;
        vars[`--typography-${role}-spacing`] = settings.letterSpacing ?? 'normal';
        if (settings.textTransform) vars[`--typography-${role}-transform`] = settings.textTransform;
    }

    // -- Colour tokens ---------------------------------------------------------
    emitColorVars(vars, theme.colors);

    // -- Raw/derived palette (verbatim values) ----------------------------------
    if (theme.palette) emitPaletteVars(vars, theme.palette);

    // -- Border radius (scalar + optional per-size scale) -----------------------
    emitRadiusVars(vars, theme.radius, theme.radiusScale);

    // -- Type scale --------------------------------------------------------------
    if (theme.typeScale) emitTypeScaleVars(vars, theme.typeScale);

    // -- Spacing -----------------------------------------------------------------
    if (theme.spacing) {
        for (const [key, val] of Object.entries(theme.spacing)) {
            vars[`--spacing-${key}`] = val;
        }
    }

    // -- Shadow elevation scale (open record: xs..xl + named extras) --------------
    emitShadowVars(vars, theme.shadows);

    // -- Border chrome -------------------------------------------------------------
    if (theme.border) emitBorderVars(vars, theme.border);

    // -- Motion / transition presets -------------------------------------------------
    // When disableAnimations: true, set durations to 0s (simpler than data-attr + global CSS)
    const noMotion = theme.motion.disableAnimations;
    vars['--duration-fast'] = noMotion ? '0s' : theme.motion.durationFast;
    vars['--duration-normal'] = noMotion ? '0s' : theme.motion.durationNormal;
    vars['--duration-slow'] = noMotion ? '0s' : theme.motion.durationSlow;
    vars['--ease'] = theme.motion.easing;
    vars['--ease-enter'] = theme.motion.easingEnter;
    vars['--ease-exit'] = theme.motion.easingExit;
    vars['--ease-spring'] = theme.motion.easingSpring;
    // Semantic --motion-* aliases match the component-level convention
    vars['--motion-duration-fast'] = noMotion ? '0s' : theme.motion.durationFast;
    vars['--motion-duration-normal'] = noMotion ? '0s' : theme.motion.durationNormal;
    vars['--motion-duration-slow'] = noMotion ? '0s' : theme.motion.durationSlow;
    vars['--motion-ease-default'] = theme.motion.easing;
    vars['--motion-ease-enter'] = theme.motion.easingEnter;
    vars['--motion-ease-exit'] = theme.motion.easingExit;
    // Named extras: --duration-{name} / --ease-{name}
    if (theme.motion.durations) {
        for (const [name, val] of Object.entries(theme.motion.durations)) {
            vars[`--duration-${name}`] = noMotion ? '0s' : val;
        }
    }
    if (theme.motion.easings) {
        for (const [name, val] of Object.entries(theme.motion.easings)) {
            vars[`--ease-${name}`] = val;
        }
    }

    // -- Interaction physics / focus ring / link contract --------------------------
    if (theme.interaction) emitInteractionVars(vars, theme.interaction);
    if (theme.focus) emitFocusVars(vars, theme.focus);
    if (theme.links) emitLinksVars(vars, theme.links);

    // -- Selection / scrollbar / native appearance ----------------------------------
    if (theme.selection) emitSelectionVars(vars, theme.selection);
    if (theme.scrollbar) emitScrollbarVars(vars, theme.scrollbar);
    if (theme.native) emitNativeVars(vars, theme.native, mode);

    // -- Z-index ladder ----------------------------------------------------------------
    if (theme.zIndex) emitZIndexVars(vars, theme.zIndex);

    // -- Page surface hooks ---------------------------------------------------------------
    if (theme.surface) emitSurfaceVars(vars, theme.surface);

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
    // Dimension tokens (sparse — only when the layout defines exact lengths)
    if (layout.containerMaxWidth) vars['--layout-container-max'] = layout.containerMaxWidth;
    if (layout.sidebarWidthCss) vars['--layout-sidebar-w'] = layout.sidebarWidthCss;
    if (layout.sidebarIconWidthCss) vars['--layout-sidebar-w-icon'] = layout.sidebarIconWidthCss;
}

// ---------------------------------------------------------------------------
// DOM injection helpers
// ---------------------------------------------------------------------------

/**
 * Writes all CSS custom properties from `varMap` onto the supplied style target.
 * Retained for tests/embedded targets — the main runtime path now writes a
 * stylesheet (see applyBrandTheme).
 */
export function injectCSSVars(
    style: { setProperty(prop: string, val: string): void },
    varMap: Record<string, string>,
): void {
    for (const [prop, val] of Object.entries(varMap)) {
        style.setProperty(prop, val);
    }
}

/** Assemble the full critical CSS (vars + scope rooms) for one or both modes. */
export function buildBrandStylesheet(theme: ResolvedBrandTheme, darkTheme?: ResolvedBrandTheme): string {
    let css = `:root {\n${varMapToDeclarations(buildCSSVarMap(theme, 'light'))}\n}`;
    if (darkTheme) {
        css += `\n.dark {\n${varMapToDeclarations(buildCSSVarMap(darkTheme, 'dark'))}\n}`;
    }
    if (theme.scopes) {
        const scopesCSS = buildScopesCSS(theme.scopes);
        if (scopesCSS) css += `\n${scopesCSS}`;
    }
    return css;
}
