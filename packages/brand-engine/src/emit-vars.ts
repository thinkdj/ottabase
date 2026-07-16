// ---------------------------------------------------------------------------
// BrandEngine – CSS variable emitters
//
// Small, per-category "token value → CSS custom property" writers shared by
// the full theme var-map builder (css-runtime.ts) and the scoped-room CSS
// builder (effects/index.ts). Each emitter writes ONLY the fields the theme
// defines — sparse categories stay sparse.
// ---------------------------------------------------------------------------

import type {
    ColorScheme,
    TokenBorder,
    TokenColors,
    TokenFocus,
    TokenInteraction,
    TokenLinks,
    TokenNative,
    TokenPalette,
    TokenScrollbar,
    TokenSelection,
    TokenSurface,
    TokenTypeScale,
} from './tokens';

export type VarMap = Record<string, string>;

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

export function toCssFontWeight(val: string | number | undefined, fallback = '400'): string {
    if (val === undefined || val === null) return fallback;
    const s = String(val).toLowerCase();
    return FONT_WEIGHT_MAP[s] ?? (Number.isNaN(Number(s)) ? fallback : s);
}

/** Generic font-family fallback per typography role */
export function fontGenericFallback(role: string): string {
    if (role === 'mono') return 'monospace';
    if (role === 'handwriting') return 'cursive';
    return 'sans-serif';
}

// ---------------------------------------------------------------------------
// Per-category emitters
// ---------------------------------------------------------------------------

export function emitColorVars(vars: VarMap, colors: Partial<TokenColors>): void {
    for (const [token, hslValue] of Object.entries(colors)) {
        if (hslValue !== undefined) vars[`--${token}`] = hslValue;
    }
}

export function emitPaletteVars(vars: VarMap, palette: TokenPalette): void {
    for (const [name, value] of Object.entries(palette)) {
        if (value !== undefined) vars[`--${name}`] = value;
    }
}

export function emitShadowVars(vars: VarMap, shadows: Record<string, string | undefined>): void {
    for (const [level, val] of Object.entries(shadows)) {
        if (val !== undefined) vars[`--shadow-${level}`] = val;
    }
}

export function emitRadiusVars(vars: VarMap, radius?: string, radiusScale?: Record<string, string>): void {
    if (radius !== undefined) vars['--radius'] = radius;
    if (radiusScale) {
        for (const [size, val] of Object.entries(radiusScale)) {
            vars[`--radius-${size}`] = val;
        }
    }
}

export function emitTypeScaleVars(vars: VarMap, typeScale: TokenTypeScale): void {
    for (const [step, val] of Object.entries(typeScale)) {
        if (typeof val === 'string') {
            vars[`--text-${step}`] = val;
        } else if (val && typeof val === 'object' && val.size) {
            vars[`--text-${step}`] = val.size;
            if (val.lineHeight) vars[`--text-${step}-lh`] = val.lineHeight;
            if (val.letterSpacing) vars[`--text-${step}-ls`] = val.letterSpacing;
            if (val.fontWeight !== undefined) vars[`--text-${step}-weight`] = toCssFontWeight(val.fontWeight);
        }
    }
}

export function emitBorderVars(vars: VarMap, border: TokenBorder): void {
    if (border.width) vars['--border-width'] = border.width;
    if (border.widthStrong) vars['--border-width-strong'] = border.widthStrong;
    if (border.style) vars['--border-style'] = border.style;
}

export function emitFocusVars(vars: VarMap, focus: TokenFocus): void {
    if (focus.width) vars['--focus-ring-width'] = focus.width;
    if (focus.style) vars['--focus-ring-style'] = focus.style;
    if (focus.color) vars['--focus-ring-color'] = focus.color;
    if (focus.offset) vars['--focus-ring-offset'] = focus.offset;
}

export function emitInteractionVars(vars: VarMap, interaction: TokenInteraction): void {
    if (interaction.hoverTransform) vars['--hover-transform'] = interaction.hoverTransform;
    if (interaction.hoverFilter) vars['--hover-filter'] = interaction.hoverFilter;
    if (interaction.hoverDuration) vars['--hover-duration'] = interaction.hoverDuration;
    if (interaction.activeTransform) vars['--press-transform'] = interaction.activeTransform;
    if (interaction.activeShadow) vars['--press-shadow'] = interaction.activeShadow;
    if (interaction.activeDuration) vars['--press-duration'] = interaction.activeDuration;
    if (interaction.easing) vars['--press-ease'] = interaction.easing;
}

export function emitLinksVars(vars: VarMap, links: TokenLinks): void {
    if (links.color) vars['--link-color'] = links.color;
    if (links.hoverColor) vars['--link-hover'] = links.hoverColor;
    if (links.visitedColor) vars['--link-visited'] = links.visitedColor;
    if (links.activeColor) vars['--link-active'] = links.activeColor;
    if (links.underline !== undefined) vars['--link-underline'] = links.underline ? 'underline' : 'none';
    if (links.thickness) vars['--link-thickness'] = links.thickness;
    if (links.offset) vars['--link-offset'] = links.offset;
    if (links.decorationStyle) vars['--link-decoration'] = links.decorationStyle;
}

export function emitSelectionVars(vars: VarMap, selection: TokenSelection): void {
    if (selection.background) vars['--selection-bg'] = selection.background;
    if (selection.foreground) vars['--selection-fg'] = selection.foreground;
}

export function emitScrollbarVars(vars: VarMap, scrollbar: TokenScrollbar): void {
    if (scrollbar.width) vars['--scrollbar-width'] = scrollbar.width;
    if (scrollbar.thumb) vars['--scrollbar-thumb'] = scrollbar.thumb;
    if (scrollbar.track) vars['--scrollbar-track'] = scrollbar.track;
}

export function emitNativeVars(vars: VarMap, native: TokenNative, mode: ColorScheme): void {
    if (native.accentColor) vars['--accent-color'] = native.accentColor;
    if (native.caretColor) vars['--caret-color'] = native.caretColor;
    if (native.tapHighlight) vars['--tap-highlight'] = native.tapHighlight;
    if (native.colorScheme) {
        // Not a custom property: color-scheme lands as a real declaration in the
        // :root/.dark block so native controls, scrollbars and autofill follow.
        vars['color-scheme'] =
            native.colorScheme === 'auto' ? (mode === 'dark' ? 'dark' : 'light') : native.colorScheme;
    }
}

export function emitZIndexVars(vars: VarMap, zIndex: Record<string, string>): void {
    for (const [name, val] of Object.entries(zIndex)) {
        vars[`--z-${name}`] = val;
    }
}

export function emitSurfaceVars(vars: VarMap, surface: TokenSurface): void {
    if (surface.backdrop) vars['--bg-backdrop'] = surface.backdrop;
}

/** Serialize a var map into indented CSS declarations. */
export function varMapToDeclarations(varMap: VarMap): string {
    return Object.entries(varMap)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
}
