// ---------------------------------------------------------------------------
// BrandEngine – Design Token Types
//
// Two families of token categories:
//   • DEFAULTED categories (color, typography, spacing, radius, shadow, motion)
//     always resolve with engine defaults merged in — they existed pre-v2 and
//     the whole UI depends on their vars being present.
//   • SPARSE categories (palette, typeScale, border, focus, interaction, links,
//     selection, scrollbar, native, zIndex, textStyles, fontFaces, effects,
//     scopes, surface) emit ONLY what a theme defines. Their fallbacks live in
//     the consumers (tailwind utilities / static shadcn.css rules) so a theme
//     that defines none of them renders pixel-identical to the pre-v2 app.
// ---------------------------------------------------------------------------

/** Typography token – fontFamily + optional web-font URL */
export interface TokenTypography {
    fontFamily: string;
    url?: string;
    lineHeight?: string;
    letterSpacing?: string;
    fontWeight?: string | number;
    /** CSS text-transform for the role (e.g. `uppercase` display headings) */
    textTransform?: string;
}

/**
 * Typography roles – open-ended map. `heading`, `body`, `handwriting` and
 * `mono` are always present after resolution (engine defaults); themes may add
 * arbitrary extra roles (`display`, `ticker`, …) emitted as `--font-{role}`.
 */
export type TokenTypographyRoles = Record<string, TokenTypography>;

/** Semantic color tokens shared across light and dark palettes (HSL channels) */
export interface TokenColors {
    background: string;
    foreground: string;
    primary: string;
    'primary-foreground': string;
    secondary: string;
    'secondary-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    input: string;
    ring: string;

    /** Surface tokens for layered UI (cards, popovers, sidebars) */
    card?: string;
    'card-foreground'?: string;
    popover?: string;
    'popover-foreground'?: string;
    'sidebar-background'?: string;
    'sidebar-foreground'?: string;
    'sidebar-border'?: string;
    'sidebar-accent'?: string;
    'sidebar-accent-foreground'?: string;
    'sidebar-ring'?: string;

    /** Scrim color behind dialogs/sheets/drawers (HSL channels, used as bg-overlay/80) */
    overlay?: string;

    /** Semantic status tokens for feedback UI */
    success?: string;
    'success-foreground'?: string;
    warning?: string;
    'warning-foreground'?: string;
    info?: string;
    'info-foreground'?: string;

    /** Data visualization palette (5 slots) */
    'chart-1'?: string;
    'chart-2'?: string;
    'chart-3'?: string;
    'chart-4'?: string;
    'chart-5'?: string;

    /** Extensible – additional custom colour tokens */
    [custom: string]: string | undefined;
}

/**
 * Raw / derived color values emitted VERBATIM as `--{name}: value`.
 * Unlike `color` (HSL channel triplets), palette values are complete CSS color
 * expressions: hex, oklch(), and crucially `color-mix()` chains referencing
 * other vars — one brand knob deriving a whole ramp in pure CSS:
 *
 *   "palette": {
 *     "upp-glow": "color-mix(in srgb, hsl(var(--primary)) 36%, transparent)",
 *     "link-wash": "color-mix(in oklab, var(--link) 8%, hsl(var(--background)))"
 *   }
 *
 * Names are theme-chosen; the resolver rejects names that collide with
 * engine-emitted vars (see `isReservedVarName`).
 */
export type TokenPalette = Record<string, string>;

/**
 * Shadow scale – open record. `xs..xl` are engine-defaulted; themes may add
 * named extras (`glow`, `lift`, …) emitted as `--shadow-{name}` and consumed
 * via `shadow-[var(--shadow-glow)]` or component hook vars.
 */
export type TokenShadows = {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
} & Record<string, string | undefined>;

/** Motion / transition presets */
export interface TokenMotion {
    /** Duration for micro-interactions like hover, focus */
    durationFast?: string;
    /** Duration for panel or element transitions */
    durationNormal?: string;
    /** Duration for page-level transitions */
    durationSlow?: string;
    /** Default easing curve */
    easing?: string;
    /** Easing curve for enter animations */
    easingEnter?: string;
    /** Easing curve for exit animations */
    easingExit?: string;
    /** Spring/bounce easing – emitted as --ease-spring (+ --motion-ease-bouncy alias) */
    easingSpring?: string;
    /** Disable all animations – sets animation: none, transition: 0s */
    disableAnimations?: boolean;
    /** Extra named durations → --duration-{name} (e.g. { press: '120ms' }) */
    durations?: Record<string, string>;
    /** Extra named easings → --ease-{name} (e.g. { settle: 'cubic-bezier(…)' }) */
    easings?: Record<string, string>;
    /**
     * @keyframes emitted in the brand effects stylesheet.
     * Value = raw keyframe body (`0% { … } 100% { … }`) or `registry:key`
     * referencing KEYFRAME_REGISTRY (shimmer, dotpulse, caret-blink, …).
     */
    keyframes?: Record<string, string>;
}

/** Motion with the base fields guaranteed after resolution (extras stay optional) */
export type ResolvedMotion = TokenMotion &
    Required<
        Pick<
            TokenMotion,
            | 'durationFast'
            | 'durationNormal'
            | 'durationSlow'
            | 'easing'
            | 'easingEnter'
            | 'easingExit'
            | 'easingSpring'
            | 'disableAnimations'
        >
    >;

/** Cursor appearance map */
export interface TokenCursors {
    default?: string;
    pointer?: string;
    text?: string;
    grab?: string;
    grabbing?: string;
    crosshair?: string;
    'not-allowed'?: string;
    [custom: string]: string | undefined;
}

/**
 * Spacing tokens – semantic keys mapped to CSS length values.
 * Keys are semantic (section, card, element, …) rather than t-shirt sizes
 * so each theme can redefine spatial rhythm independently.
 */
export type TokenSpacing = Record<string, string>;

/**
 * Type-scale step – either a bare size string or size + paired metrics.
 * Emitted as --text-{step} (+ --text-{step}-lh / -ls / -weight when given).
 * Tailwind's text-{step} utilities consume them with stock-value fallbacks,
 * so existing `text-sm` call sites become themeable without edits.
 */
export type TypeScaleStep =
    | string
    | {
          size: string;
          lineHeight?: string;
          letterSpacing?: string;
          fontWeight?: string | number;
      };

/** Named type-scale steps (xs, sm, base, lg, xl, 2xl, … + theme-invented steps) */
export type TokenTypeScale = Record<string, TypeScaleStep>;

/**
 * Radius – a single scalar (pre-v2 behaviour: sizes derive via calc) or a
 * per-size record. Record keys emit --radius-{size}; `base` (or `lg`) also
 * emits the scalar --radius for the calc-chain fallbacks.
 * `full` controls pill/circle shapes (--radius-full, default 9999px) — set it
 * to e.g. `2px` to ban pills across the whole app.
 */
export type TokenRadius = string | Partial<Record<'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full', string>>;

/** Border chrome tokens */
export interface TokenBorder {
    /** Default border width – backs Tailwind's bare `border` utility */
    width?: string;
    /** Strong/structural border width (--border-width-strong) */
    widthStrong?: string;
    /** Global default border style (solid, dashed, ridge, …) */
    style?: string;
}

/** Focus-visible ring tokens – consumed by the global focus rule in shadcn.css */
export interface TokenFocus {
    /** Ring thickness (default 2px) */
    width?: string;
    /** outline-style: solid | dotted | dashed | double (default solid) */
    style?: string;
    /** Full CSS color (may reference vars); default hsl(var(--ring)) */
    color?: string;
    /** Gap between element and ring (default 2px) */
    offset?: string;
}

/**
 * Interaction physics – global hover/press feel applied to interactive
 * data-slot elements. All values default to identity (no visual change).
 */
export interface TokenInteraction {
    /** transform on hover (e.g. `translateY(-1px)`) */
    hoverTransform?: string;
    /** filter on hover (e.g. `brightness(1.05)`) */
    hoverFilter?: string;
    /** transform on :active press (e.g. `scale(0.97)`) */
    activeTransform?: string;
    /** box-shadow on :active press (e.g. inset hard shadow) */
    activeShadow?: string;
    /** press transition duration (default var(--duration-fast)) */
    activeDuration?: string;
    /** hover transition duration */
    hoverDuration?: string;
    /** easing for hover/press transitions (e.g. the spring) */
    easing?: string;
}

/**
 * Link contract – colors + underline policy for CONTENT anchors.
 * Rules are generated (zero-specificity :where) only when set, so app chrome
 * anchors styled via utility classes keep their look.
 */
export interface TokenLinks {
    /** Full CSS color for links (e.g. `var(--link)` or `#2323E8`) */
    color?: string;
    hoverColor?: string;
    /** :visited color – the web's founding contract (pin it, never retint) */
    visitedColor?: string;
    /** :active flash color */
    activeColor?: string;
    /** underline policy: true = always underline, false = never */
    underline?: boolean;
    /** text-decoration-thickness */
    thickness?: string;
    /** text-underline-offset */
    offset?: string;
    /** text-decoration-style (solid, dotted, wavy, …) */
    decorationStyle?: string;
}

/** ::selection colors (full CSS color values) */
export interface TokenSelection {
    background?: string;
    foreground?: string;
}

/** Scrollbar appearance (standards-based scrollbar-width/scrollbar-color) */
export interface TokenScrollbar {
    /** auto | thin | none */
    width?: string;
    /** thumb color (full CSS color) */
    thumb?: string;
    /** track color (full CSS color) */
    track?: string;
}

/** Browser-native appearance overrides */
export interface TokenNative {
    /**
     * CSS color-scheme. `auto` emits light on :root and dark on .dark so
     * native form controls, scrollbars and autofill follow the active mode.
     * Also accepts explicit values (`light`, `dark`, `light dark`).
     */
    colorScheme?: 'auto' | (string & {});
    /** accent-color for native checkbox/radio/progress/range (full CSS color) */
    accentColor?: string;
    /** caret-color for text inputs (full CSS color) */
    caretColor?: string;
    /** -webkit-tap-highlight-color (full CSS color, e.g. `transparent`) */
    tapHighlight?: string;
}

/** Z-index ladder → --z-{name}; Tailwind maps the closed set of names below */
export type TokenZIndex = Record<string, string | number>;

/**
 * Named text-style voices → generated `.ts-{name}` utility classes.
 * Declarative alternative to customCss for kickers, tickers, OSD labels, etc.
 */
export interface TokenTextStyle {
    /** typography role providing the font-family (heading, mono, …) */
    fontRole?: string;
    size?: string;
    fontWeight?: string | number;
    /** font-stretch (width axis of variable fonts) */
    stretch?: string;
    letterSpacing?: string;
    textTransform?: string;
    lineHeight?: string;
    /** full CSS color (may reference vars) */
    color?: string;
}

export type TokenTextStyles = Record<string, TokenTextStyle>;

/** Self-hosted @font-face declaration emitted in the effects stylesheet */
export interface TokenFontFace {
    family: string;
    /** full src value, e.g. `url(/fonts/archivo.woff2) format('woff2')` */
    src: string;
    /** weight or variable range, e.g. `100 900` */
    weight?: string;
    style?: string;
    /** stretch range for variable width axes, e.g. `62% 125%` */
    stretch?: string;
    /** font-display (default `swap`) */
    display?: string;
}

/**
 * Effect utilities → generated `.{className} { … }` rules.
 * Value = `registry:key` referencing EFFECT_REGISTRY (scanlines, noise,
 * vignette, groove, …) or raw CSS declarations.
 */
export interface TokenEffects {
    utilities?: Record<string, string>;
    /**
     * Theme-owned raw CSS appended to the effects stylesheet verbatim
     * (sanitized at injection). This makes a design system's bespoke recipes
     * (press-state chrome, bracket controls, counters) PRESET-portable —
     * unlike kit customCss, it travels inside the theme JSON.
     */
    css?: string;
}

/** Page-level surface hooks */
export interface TokenSurface {
    /**
     * body background-image layer(s) — gradients/textures behind all content.
     * Emitted as --bg-backdrop, consumed by a static body rule.
     */
    backdrop?: string;
}

// ---------------------------------------------------------------------------
// Token aliases – allow one token to reference another by name
// ---------------------------------------------------------------------------

/** Alias map – e.g. `{ "brand": "primary", "bgSurface": "card" }` */
export type TokenAliases = Record<string, string>;

// ---------------------------------------------------------------------------
// Design Tokens aggregate
// ---------------------------------------------------------------------------

/**
 * A token value that can optionally be overridden per color scheme (light, dark, etc.)
 * If provided as a single value `T`, it applies to all modes.
 * If provided as an object with `light`/`dark` keys, the resolver extracts the active mode.
 */
export type ModeValue<T> =
    | T
    | {
          light?: T;
          dark?: T;
          [scheme: string]: T | undefined;
      };

/**
 * Named color scheme identifier.
 * `light` and `dark` are always present. Additional custom schemes
 * (e.g. `'high-contrast'`, `'colorblind-deuteranopia'`) can be added
 * and resolved at runtime via the `mode` parameter.
 */
export type ColorScheme = 'light' | 'dark' | (string & {});

/**
 * Color palette map keyed by scheme name.
 * `light` and `dark` are required; additional custom schemes are optional.
 */
export type ColorPalettes = {
    light: TokenColors;
    dark: TokenColors;
    /** Custom color schemes (high-contrast, colorblind-safe, seasonal, etc.) */
    [scheme: string]: TokenColors | undefined;
};

/**
 * Scoped token "room" – re-binds a subset of tokens for a DOM subtree via
 * `[data-brand-scope="name"] { --var: … }` (a dark hero chrome inside a light
 * page, the90s.page's `afterdark`, a cinema `screen` room, …).
 * Categories carry their own light/dark split (ModeValue) — a room is often
 * mode-independent (always-dark chrome), which a flat value expresses.
 */
export interface ScopeTokens {
    color?: ModeValue<Partial<TokenColors>>;
    palette?: ModeValue<TokenPalette>;
    shadow?: ModeValue<TokenShadows>;
    radius?: ModeValue<TokenRadius>;
    border?: ModeValue<TokenBorder>;
    links?: ModeValue<TokenLinks>;
    selection?: ModeValue<TokenSelection>;
    focus?: ModeValue<TokenFocus>;
}

export type TokenScopes = Record<string, ScopeTokens>;

/**
 * The complete set of design tokens that defines a brand's visual identity.
 * This is the "single JSON source" described in the BrandEngine spec.
 */
export interface DesignTokens {
    color: ColorPalettes;
    /** Raw/derived CSS color values emitted verbatim (see TokenPalette) */
    palette?: ModeValue<TokenPalette>;
    typography?: ModeValue<TokenTypographyRoles>;
    /** Named font-size steps backing Tailwind's text-{step} utilities */
    typeScale?: ModeValue<TokenTypeScale>;
    spacing?: ModeValue<TokenSpacing>;
    radius?: ModeValue<TokenRadius>;
    shadow?: ModeValue<TokenShadows>;
    border?: ModeValue<TokenBorder>;
    motion?: ModeValue<TokenMotion>;
    focus?: ModeValue<TokenFocus>;
    interaction?: ModeValue<TokenInteraction>;
    links?: ModeValue<TokenLinks>;
    selection?: ModeValue<TokenSelection>;
    scrollbar?: ModeValue<TokenScrollbar>;
    native?: ModeValue<TokenNative>;
    zIndex?: ModeValue<TokenZIndex>;
    textStyles?: ModeValue<TokenTextStyles>;
    fontFaces?: TokenFontFace[];
    effects?: TokenEffects;
    scopes?: TokenScopes;
    surface?: ModeValue<TokenSurface>;
    /** Token aliases – remap semantic names to other token keys */
    aliases?: TokenAliases;
}

/**
 * Single source of truth for every category key on DesignTokens.
 * Consumed by expandPresetToTokens (admin save passthrough — anything missing
 * here is silently DROPPED on preset apply), the legacy adapter, and preview.
 * `cursors` is intentionally absent — it lives at the tokensJson ROOT, not
 * inside DesignTokens (pre-existing convention).
 */
export const TOKEN_CATEGORY_KEYS = [
    'color',
    'palette',
    'typography',
    'typeScale',
    'spacing',
    'radius',
    'shadow',
    'border',
    'motion',
    'focus',
    'interaction',
    'links',
    'selection',
    'scrollbar',
    'native',
    'zIndex',
    'textStyles',
    'fontFaces',
    'effects',
    'scopes',
    'surface',
    'aliases',
] as const satisfies readonly (keyof DesignTokens)[];

export type TokenCategoryKey = (typeof TOKEN_CATEGORY_KEYS)[number];

/**
 * Var-name prefixes the engine emits. Palette keys colliding with these are
 * dropped by the resolver (with a console warning) to protect engine vars.
 * Links tokens reserve EXACT names (not the `link-` prefix) so themes can
 * define palette ramps like `link-lift` / `link-wash`.
 */
const RESERVED_VAR_PREFIXES = [
    'font-',
    'text-',
    'radius',
    'shadow-',
    'spacing-',
    'duration-',
    'ease',
    'motion-',
    'typography-',
    'layout-',
    'cursor-',
    'border-width',
    'border-style',
    'focus-ring',
    'hover-',
    'press-',
    'selection-',
    'scrollbar-',
    'z-',
    'ts-',
];

const RESERVED_VAR_NAMES = new Set([
    'bg-backdrop',
    'accent-color',
    'caret-color',
    'tap-highlight',
    'link-color',
    'link-hover',
    'link-visited',
    'link-active',
    'link-thickness',
    'link-offset',
    'link-decoration',
]);

/** True when a palette key would shadow an engine-emitted CSS variable. */
export function isReservedVarName(name: string): boolean {
    return RESERVED_VAR_NAMES.has(name) || RESERVED_VAR_PREFIXES.some((p) => name === p || name.startsWith(p));
}
