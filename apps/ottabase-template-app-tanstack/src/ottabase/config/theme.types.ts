export interface ThemeTypography {
    fontFamily: string;
    url?: string;
}

/** Base semantic color tokens shared across light and dark palettes */
export interface ThemeColors {
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
}

/** Shadow elevation scale */
export interface ThemeShadows {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
}

/** Motion / transition presets */
export interface ThemeMotion {
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

/** Cursor appearance map (CSS or registry refs) */
export interface ThemeCursors {
    default?: string;
    pointer?: string;
    text?: string;
    grab?: string;
    grabbing?: string;
    crosshair?: string;
    'not-allowed'?: string;
    [custom: string]: string | undefined;
}

export interface ThemeConfig {
    name: string;
    typography: {
        heading: ThemeTypography;
        body: ThemeTypography;
        handwriting: ThemeTypography;
    };
    colors: {
        light: ThemeColors;
        dark: ThemeColors;
    };
    spacing?: Record<string, string>;
    radius?: string;
    shadows?: ThemeShadows;
    motion?: ThemeMotion;
    appearance?: {
        cursors?: ThemeCursors;
    };
}
