// ---------------------------------------------------------------------------
// Brand Engine – Generated CSS builders
//
// Two builders for the OPEN-ENDED parts of a theme that cannot be expressed
// as :root variables consumed by static rules:
//
//   • buildScopesCSS   – token "rooms": [data-brand-scope=name] var re-binding
//                        blocks (appended to the critical stylesheet)
//   • buildEffectsCSS  – the #brand-effects stylesheet: @font-face, @keyframes,
//                        .ts-{name} text-style voices, the link contract, and
//                        registry-backed effect utilities
//
// Fixed-shape rules (focus ring, ::selection, scrollbar, press physics, body
// backdrop) are NOT generated — they live statically in ui-shadcn's shadcn.css
// reading vars with pixel-identical fallbacks.
//
// Specificity discipline: every generated selector is wrapped in :where() so
// any utility class on the element wins. Values flow through var() references
// wherever possible so rooms/mode switches retint without regeneration.
// ---------------------------------------------------------------------------

import {
    emitBorderVars,
    emitColorVars,
    emitFocusVars,
    emitLinksVars,
    emitPaletteVars,
    emitRadiusVars,
    emitSelectionVars,
    emitShadowVars,
    toCssFontWeight,
    varMapToDeclarations,
} from '../emit-vars';
import type { VarMap } from '../emit-vars';
import { pickMode } from '../resolve-core';
import type { ResolvedBrandTheme } from '../resolver';
import type { ScopeTokens, TokenRadius, TokenScopes } from '../tokens';
import { isReservedVarName } from '../tokens';
import { EFFECT_REGISTRY, KEYFRAME_REGISTRY, resolveRegistryValue } from './registry';

export { EFFECT_REGISTRY, KEYFRAME_REGISTRY, resolveRegistryValue } from './registry';

/** Valid CSS identifier for generated class/scope/keyframe names */
const CSS_IDENT = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Guard against rule breakout inside generated declaration blocks. */
function safeDeclarations(decls: string): string {
    return decls.replace(/[{}<>]/g, '');
}

// ---------------------------------------------------------------------------
// Scoped rooms
// ---------------------------------------------------------------------------

/** Build the sparse var map for one scope in one mode. */
function buildScopeVarMap(scope: ScopeTokens, mode: 'light' | 'dark'): VarMap {
    const vars: VarMap = {};

    const color = pickMode(scope.color, mode);
    if (color) emitColorVars(vars, color);

    const palette = pickMode(scope.palette, mode);
    if (palette) {
        const clean: Record<string, string> = {};
        for (const [name, val] of Object.entries(palette)) {
            if (typeof val === 'string' && !isReservedVarName(name)) clean[name] = val;
        }
        emitPaletteVars(vars, clean);
    }

    const shadow = pickMode(scope.shadow, mode);
    if (shadow) emitShadowVars(vars, shadow);

    const radius = pickMode<TokenRadius>(scope.radius, mode);
    if (typeof radius === 'string') {
        emitRadiusVars(vars, radius);
    } else if (radius && typeof radius === 'object') {
        const scale: Record<string, string> = {};
        for (const [size, val] of Object.entries(radius)) {
            if (typeof val === 'string' && size !== 'base') scale[size] = val;
        }
        emitRadiusVars(vars, (radius as Record<string, string>).base ?? (radius as Record<string, string>).lg, scale);
    }

    const border = pickMode(scope.border, mode);
    if (border) emitBorderVars(vars, border);

    const links = pickMode(scope.links, mode);
    if (links) emitLinksVars(vars, links);

    const selection = pickMode(scope.selection, mode);
    if (selection) emitSelectionVars(vars, selection);

    const focus = pickMode(scope.focus, mode);
    if (focus) emitFocusVars(vars, focus);

    return vars;
}

/** True when any category of the scope has an explicit { dark } split. */
function scopeHasDarkSplit(scope: ScopeTokens): boolean {
    return Object.values(scope).some(
        (val) => typeof val === 'object' && val !== null && !Array.isArray(val) && 'dark' in val,
    );
}

/**
 * Emit `[data-brand-scope="name"] { --var: … }` blocks for every scope room.
 * A flat (non-split) scope emits one block that applies in both modes; scopes
 * with a dark split additionally emit a `.dark [data-brand-scope=…]` block.
 * Components inside the scope "dress themselves" — they already read the
 * semantic vars, so no props/flags are needed.
 */
export function buildScopesCSS(scopes: TokenScopes): string {
    const blocks: string[] = [];

    for (const [name, scope] of Object.entries(scopes)) {
        if (!CSS_IDENT.test(name) || !scope || typeof scope !== 'object') continue;

        const lightVars = buildScopeVarMap(scope, 'light');
        if (Object.keys(lightVars).length > 0) {
            blocks.push(`[data-brand-scope="${name}"] {\n${varMapToDeclarations(lightVars)}\n}`);
        }

        if (scopeHasDarkSplit(scope)) {
            const darkVars = buildScopeVarMap(scope, 'dark');
            if (Object.keys(darkVars).length > 0) {
                blocks.push(`.dark [data-brand-scope="${name}"] {\n${varMapToDeclarations(darkVars)}\n}`);
            }
        }
    }

    return blocks.join('\n');
}

// ---------------------------------------------------------------------------
// Effects stylesheet
// ---------------------------------------------------------------------------

/** @font-face rules from theme.fontFaces */
function buildFontFaceCSS(theme: ResolvedBrandTheme): string {
    if (!theme.fontFaces?.length) return '';
    return theme.fontFaces
        .filter((f) => f.family && f.src)
        .map((f) => {
            const decls = [
                `font-family: "${f.family.replace(/["\\]/g, '')}";`,
                `src: ${safeDeclarations(f.src)};`,
                f.weight ? `font-weight: ${safeDeclarations(f.weight)};` : '',
                f.style ? `font-style: ${safeDeclarations(f.style)};` : '',
                f.stretch ? `font-stretch: ${safeDeclarations(f.stretch)};` : '',
                `font-display: ${safeDeclarations(f.display ?? 'swap')};`,
            ]
                .filter(Boolean)
                .map((d) => `  ${d}`)
                .join('\n');
            return `@font-face {\n${decls}\n}`;
        })
        .join('\n');
}

/** @keyframes rules from motion.keyframes (registry: refs resolved) */
function buildKeyframesCSS(theme: ResolvedBrandTheme): string {
    const keyframes = theme.motion?.keyframes;
    if (!keyframes) return '';
    const rules: string[] = [];
    for (const [name, raw] of Object.entries(keyframes)) {
        if (!CSS_IDENT.test(name) || typeof raw !== 'string') continue;
        const body = resolveRegistryValue(raw, KEYFRAME_REGISTRY);
        if (!body) continue;
        rules.push(`@keyframes ${name} {\n  ${body.replace(/[<>]/g, '')}\n}`);
    }
    return rules.join('\n');
}

/** .ts-{name} text-style voice classes */
function buildTextStylesCSS(theme: ResolvedBrandTheme): string {
    if (!theme.textStyles) return '';
    const rules: string[] = [];
    for (const [name, style] of Object.entries(theme.textStyles)) {
        if (!CSS_IDENT.test(name) || !style || typeof style !== 'object') continue;
        const decls: string[] = [];
        if (style.fontRole) decls.push(`font-family: var(--font-${style.fontRole.replace(/[^A-Za-z0-9_-]/g, '')});`);
        if (style.size) decls.push(`font-size: ${safeDeclarations(style.size)};`);
        if (style.fontWeight !== undefined) decls.push(`font-weight: ${toCssFontWeight(style.fontWeight)};`);
        if (style.stretch) decls.push(`font-stretch: ${safeDeclarations(style.stretch)};`);
        if (style.letterSpacing) decls.push(`letter-spacing: ${safeDeclarations(style.letterSpacing)};`);
        if (style.textTransform) decls.push(`text-transform: ${safeDeclarations(style.textTransform)};`);
        if (style.lineHeight) decls.push(`line-height: ${safeDeclarations(style.lineHeight)};`);
        if (style.color) decls.push(`color: ${safeDeclarations(style.color)};`);
        if (decls.length === 0) continue;
        rules.push(`.ts-${name} {\n${decls.map((d) => `  ${d}`).join('\n')}\n}`);
    }
    return rules.join('\n');
}

/**
 * Link contract rules — generated ONLY when the theme defines links tokens.
 * Targets unclassed anchors (content links) plus `.brand-link` opt-in.
 * Specificity is deliberate: `a:where(:not([class]))` is 0-0-1 — it BEATS
 * Tailwind preflight's `a { color: inherit; text-decoration: inherit }` by
 * cascade order (this sheet loads later) while still losing to any utility
 * class (0-1-0) on chrome anchors. `.brand-link` (0-1-0) is the opt-in that
 * ties with utilities and wins by order.
 */
function buildLinksCSS(theme: ResolvedBrandTheme): string {
    const links = theme.links;
    if (!links || Object.keys(links).length === 0) return '';

    const rules: string[] = [];
    // Selector LIST (not :is()) so each part keeps its own specificity:
    // unclassed anchors at 0-0-1, the .brand-link opt-in at 0-1-0.
    const sel = (state: string) => `a:where(:not([class]))${state}, .brand-link${state}`;

    const base: string[] = [];
    if (links.color) base.push('color: var(--link-color);');
    if (links.underline !== undefined) base.push('text-decoration-line: var(--link-underline);');
    else if (links.thickness || links.offset || links.decorationStyle) base.push('text-decoration-line: underline;');
    if (links.thickness) base.push('text-decoration-thickness: var(--link-thickness);');
    if (links.offset) base.push('text-underline-offset: var(--link-offset);');
    if (links.decorationStyle) base.push('text-decoration-style: var(--link-decoration);');
    if (base.length > 0) rules.push(`${sel('')} {\n${base.map((d) => `  ${d}`).join('\n')}\n}`);

    // Order matters for the anchor state chain: link → visited → hover → active
    if (links.visitedColor) rules.push(`${sel(':visited')} {\n  color: var(--link-visited);\n}`);
    if (links.hoverColor) rules.push(`${sel(':hover')} {\n  color: var(--link-hover);\n}`);
    if (links.activeColor) rules.push(`${sel(':active')} {\n  color: var(--link-active);\n}`);

    return rules.join('\n');
}

/**
 * Interaction press extras — only the pieces that CANNOT live as static rules
 * in shadcn.css because they lack a safe identity fallback (box-shadow: none
 * would kill a component's own shadow while pressed; transition overrides
 * would fight per-component duration utilities). The hover/press transforms
 * themselves ARE static (shadcn.css) since `none` is a true identity.
 * A reduced-motion guard neutralizes the physics vars.
 */
function buildInteractionCSS(theme: ResolvedBrandTheme): string {
    const interaction = theme.interaction;
    if (!interaction || Object.keys(interaction).length === 0) return '';

    const sel =
        ":where([data-slot='button'], [data-slot='toggle'], [data-press]):not(:disabled, [aria-disabled='true'])";
    const rules: string[] = [];

    const hover: string[] = [];
    if (interaction.hoverDuration) hover.push('  transition-duration: var(--hover-duration);');
    if (interaction.easing) hover.push('  transition-timing-function: var(--press-ease);');
    if (hover.length > 0) rules.push(`${sel}:hover {\n${hover.join('\n')}\n}`);

    const active: string[] = [];
    if (interaction.activeShadow) active.push('  box-shadow: var(--press-shadow);');
    if (interaction.activeDuration) active.push('  transition-duration: var(--press-duration);');
    if (interaction.easing) active.push('  transition-timing-function: var(--press-ease);');
    if (active.length > 0) rules.push(`${sel}:active {\n${active.join('\n')}\n}`);

    // Physics respect reduced motion (the duration tokens are already zeroed
    // by the shadcn.css guard; transforms/shadows are neutralized here).
    rules.push(
        '@media (prefers-reduced-motion: reduce) {\n' +
            '  :root {\n' +
            '    --hover-transform: none !important;\n' +
            '    --press-transform: none !important;\n' +
            '    --press-shadow: none !important;\n' +
            '  }\n' +
            '}',
    );

    return rules.join('\n');
}

/** Registry-backed effect utility classes from effects.utilities */
function buildEffectUtilitiesCSS(theme: ResolvedBrandTheme): string {
    const utilities = theme.effects?.utilities;
    if (!utilities) return '';
    const rules: string[] = [];
    for (const [className, raw] of Object.entries(utilities)) {
        if (!CSS_IDENT.test(className) || typeof raw !== 'string') continue;
        const decls = resolveRegistryValue(raw, EFFECT_REGISTRY);
        if (!decls) continue;
        rules.push(`.${className} {\n  ${safeDeclarations(decls)}\n}`);
    }
    return rules.join('\n');
}

/**
 * Build the #brand-effects stylesheet: every generated (non-var) rule the
 * theme needs. Returns '' when the theme uses none of the generative
 * categories — zero-config themes ship zero extra bytes.
 */
export function buildEffectsCSS(theme: ResolvedBrandTheme): string {
    return [
        buildFontFaceCSS(theme),
        buildKeyframesCSS(theme),
        buildTextStylesCSS(theme),
        buildLinksCSS(theme),
        buildInteractionCSS(theme),
        buildEffectUtilitiesCSS(theme),
        // Theme-owned raw CSS (preset-portable escape hatch). Sanitization for
        // tag safety happens at the injection sites (edge: sanitizeCssForStyleTag;
        // client: textContent assignment cannot break out of the style element).
        theme.effects?.css ?? '',
    ]
        .filter(Boolean)
        .join('\n');
}
