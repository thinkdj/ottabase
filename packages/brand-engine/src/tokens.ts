// ---------------------------------------------------------------------------
// BrandEngine – Design Token Types
// ---------------------------------------------------------------------------

/** Typography token – fontFamily + optional web-font URL */
export interface TokenTypography {
    fontFamily: string;
    url?: string;
}

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

/** Shadow elevation scale */
export interface TokenShadows {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
}

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
}

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

// ---------------------------------------------------------------------------
// Token aliases – allow one token to reference another by name
// ---------------------------------------------------------------------------

/** Alias map – e.g. `{ "brand": "primary", "bgSurface": "card" }` */
export type TokenAliases = Record<string, string>;

// ---------------------------------------------------------------------------
// Design Tokens aggregate
// ---------------------------------------------------------------------------

/**
 * The complete set of design tokens that defines a brand's visual identity.
 * This is the "single JSON source" described in the BrandEngine spec.
 */
export interface DesignTokens {
    color: {
        light: TokenColors;
        dark: TokenColors;
    };
    typography: {
        heading: TokenTypography;
        body: TokenTypography;
        handwriting: TokenTypography;
    };
    spacing?: TokenSpacing;
    radius?: string;
    shadow?: TokenShadows;
    motion?: TokenMotion;
    /** Token aliases – remap semantic names to other token keys */
    aliases?: TokenAliases;
}
