// ---------------------------------------------------------------------------
// BrandEngine – Default token values
//
// The defaults ARE the Ottabase Design System v1 (verdant): one green, cool
// neutrals with a trace of it, Inter + JetBrains Mono, a fixed status
// language. Every theme merges on top of these, so a kit that only sets
// `primary` still gets the system's surfaces, text ladder and tones.
// ---------------------------------------------------------------------------

import type { BrandTheme } from './theme';
import type { ResolvedMotion, TokenColors, TokenCursors, TokenSpacing, TokenTypographyRoles } from './tokens';

/**
 * Status tones, light. Fixed across every surface and every theme: green =
 * healthy / active / done, amber = grace / waiting / degraded, red = failed /
 * expired / unreachable, blue = running, smoke = quiet (disabled, unlicensed,
 * never polled), neutral = no state. Each tone: solid (dot, bar, icon),
 * -foreground (text ON the solid), -text (text on a surface, AA), -soft (fill),
 * -line (border). The brand green and the status green share a hue on purpose.
 */
const STATUS_TONES_LIGHT = {
    success: '153.4 57.8% 39%',
    'success-foreground': '0 0% 100%',
    'success-text': '154.7 55.1% 27.1%',
    'success-soft': '145.7 38.9% 92.9%',
    'success-line': '145.5 37.7% 79.2%',
    warning: '42 82.1% 46.1%',
    'warning-foreground': '142.5 18.2% 8.6%',
    'warning-text': '39.1 100% 27.1%',
    'warning-soft': '41.8 89.2% 92.7%',
    'warning-line': '43.4 75.7% 77.5%',
    destructive: '3.8 69.6% 51%',
    'destructive-foreground': '0 0% 100%',
    'destructive-text': '3.2 71.3% 41%',
    'destructive-soft': '6.3 82.6% 95.5%',
    'destructive-line': '4.7 71.8% 86.1%',
    info: '210.2 66.3% 50%',
    'info-foreground': '0 0% 100%',
    'info-text': '212.5 72.3% 39.6%',
    'info-soft': '213 76.9% 94.9%',
    'info-line': '212.9 73.9% 86.5%',
    smoke: '216.3 15.8% 52.9%',
    'smoke-foreground': '0 0% 100%',
    'smoke-text': '212 16% 36.9%',
    'smoke-soft': '210 21.4% 94.5%',
    'smoke-line': '210 21.1% 85.1%',
    neutral: '150 6.5% 57.6%',
    'neutral-foreground': '0 0% 100%',
    'neutral-text': '148 9.1% 32.4%',
    'neutral-soft': '135 13.3% 94.1%',
    'neutral-line': '146.7 12% 85.3%',
} as const;

/** Status tones, dark. */
const STATUS_TONES_DARK = {
    success: '152.8 48.1% 47.6%',
    'success-foreground': '150 42.9% 5.5%',
    'success-text': '148.2 48% 66.1%',
    'success-soft': '148.7 39% 11.6%',
    'success-line': '149.3 42.1% 21%',
    warning: '41 75% 51.4%',
    'warning-foreground': '150 42.9% 5.5%',
    'warning-text': '41.4 83.1% 65.1%',
    'warning-soft': '42.2 45.8% 11.6%',
    'warning-line': '41.9 56.8% 21.8%',
    destructive: '5 82.1% 62.7%',
    'destructive-foreground': '150 42.9% 5.5%',
    'destructive-text': '5.5 83.2% 76.7%',
    'destructive-soft': '6.2 39.7% 14.3%',
    'destructive-line': '5.2 43.9% 25.9%',
    info: '212.5 77.3% 60.2%',
    'info-foreground': '150 42.9% 5.5%',
    'info-text': '211.8 83.6% 76.1%',
    'info-soft': '214.1 46.8% 15.5%',
    'info-line': '215.5 50.4% 27.6%',
    smoke: '214.7 19.4% 61.6%',
    'smoke-foreground': '150 42.9% 5.5%',
    'smoke-text': '212.9 20.8% 70.8%',
    'smoke-soft': '212.3 18.8% 13.5%',
    'smoke-line': '211.2 19.7% 24.9%',
    neutral: '150 6.5% 57.6%',
    'neutral-foreground': '150 42.9% 5.5%',
    'neutral-text': '147.3 7.3% 70.4%',
    'neutral-soft': '144 15.6% 12.5%',
    'neutral-line': '147.7 12.1% 21%',
} as const;

/**
 * Charts, light. Categorical order is fixed: slots 1 to 8 are assigned in
 * order, never cycled. Grid, axis and label are the recessive chrome.
 */
const CHART_LIGHT = {
    'chart-1': '156 51.7% 34.1%',
    'chart-2': '210.2 66.3% 50%',
    'chart-3': '42 82.1% 46.1%',
    'chart-4': '264.1 55.5% 58.6%',
    'chart-5': '21.2 71.2% 52.4%',
    'chart-6': '182.2 72.5% 37.1%',
    'chart-7': '329.5 55.9% 60%',
    'chart-8': '216.3 15.8% 52.9%',
    'chart-grid': '144 11.6% 91.6%',
    'chart-axis': '145 9.1% 74.1%',
    'chart-label': '148 7.5% 39.4%',
} as const;

const CHART_DARK = {
    'chart-1': '152.8 48.1% 47.6%',
    'chart-2': '212.5 77.3% 60.2%',
    'chart-3': '41 75% 51.4%',
    'chart-4': '260.4 67.3% 70%',
    'chart-5': '20 80.4% 62%',
    'chart-6': '182.1 59.8% 45.9%',
    'chart-7': '330 65.9% 67.8%',
    'chart-8': '214.7 19.4% 61.6%',
    'chart-grid': '147.3 12.6% 17.1%',
    'chart-axis': '145.7 10.8% 25.5%',
    'chart-label': '150 6.5% 57.6%',
} as const;

/**
 * Default light-mode colour palette (Design System v1, verdant).
 * Surfaces: background = page, card/popover/sidebar = surface, muted = subtle
 * fill (table head, hover), secondary = pressed/selected neutral.
 * Text ladder: foreground, subtle-foreground, muted-foreground, faint-foreground.
 * 600 green is the action fill, 700 is text and links, 500 is the focus ring.
 */
export const DEFAULT_COLORS_LIGHT: TokenColors = {
    background: '150 12.5% 96.9%',
    foreground: '142.5 18.2% 8.6%',
    primary: '156 51.7% 34.1%',
    'primary-foreground': '0 0% 100%',
    'primary-hover': '156.2 52.5% 27.3%',
    'primary-active': '157.5 50.9% 21.6%',
    secondary: '140 12.5% 90.6%',
    'secondary-foreground': '142.5 18.2% 8.6%',
    muted: '135 13.3% 94.1%',
    'muted-foreground': '148 7.5% 39.4%',
    'subtle-foreground': '148 9.1% 32.4%',
    'faint-foreground': '150 6% 54.5%',
    accent: '145.7 38.9% 92.9%',
    'accent-foreground': '156.2 52.5% 27.3%',
    'accent-line': '145.5 37.7% 79.2%',
    border: '145.7 12.7% 89.2%',
    input: '147.3 10.1% 78.6%',
    ring: '153.1 53.2% 39.4%',
    card: '0 0% 100%',
    'card-foreground': '142.5 18.2% 8.6%',
    popover: '0 0% 100%',
    'popover-foreground': '142.5 18.2% 8.6%',
    'sidebar-background': '0 0% 100%',
    'sidebar-foreground': '148 9.1% 32.4%',
    'sidebar-border': '145.7 12.7% 89.2%',
    'sidebar-accent': '145.7 38.9% 92.9%',
    'sidebar-accent-foreground': '156.2 52.5% 27.3%',
    'sidebar-ring': '153.1 53.2% 39.4%',
    overlay: '150 16.7% 7.1%',
    ...STATUS_TONES_LIGHT,
    ...CHART_LIGHT,
};

/** Default dark-mode colour palette (Design System v1, verdant). 400 is text and links, 500 the fill. */
export const DEFAULT_COLORS_DARK: TokenColors = {
    background: '150 16.7% 7.1%',
    foreground: '142.5 16.7% 90.6%',
    primary: '153.1 53.2% 39.4%',
    'primary-foreground': '150 42.9% 5.5%',
    'primary-hover': '152.6 40.4% 50%',
    'primary-active': '156 51.7% 34.1%',
    secondary: '145 14.6% 16.1%',
    'secondary-foreground': '142.5 16.7% 90.6%',
    muted: '144 15.6% 12.5%',
    'muted-foreground': '150 6.5% 57.6%',
    'subtle-foreground': '147.3 7.3% 70.4%',
    'faint-foreground': '148 6.8% 42.9%',
    accent: '151.4 33.3% 12.4%',
    'accent-foreground': '152.6 40.4% 50%',
    'accent-line': '153.1 39.8% 24.1%',
    border: '147.3 12.6% 17.1%',
    input: '145.7 10.8% 25.5%',
    ring: '152.6 40.4% 50%',
    card: '142.5 16% 9.8%',
    'card-foreground': '142.5 16.7% 90.6%',
    popover: '142.5 16% 9.8%',
    'popover-foreground': '142.5 16.7% 90.6%',
    'sidebar-background': '142.5 16% 9.8%',
    'sidebar-foreground': '147.3 7.3% 70.4%',
    'sidebar-border': '147.3 12.6% 17.1%',
    'sidebar-accent': '151.4 33.3% 12.4%',
    'sidebar-accent-foreground': '152.6 40.4% 50%',
    'sidebar-ring': '152.6 40.4% 50%',
    overlay: '0 0% 0%',
    ...STATUS_TONES_DARK,
    ...CHART_DARK,
};

/** Default shadow elevation scale (light). Borders do the work; shadows lift only what floats. */
export const DEFAULT_SHADOWS: Record<string, string> = {
    xs: '0 1px 2px rgb(18 26 21 / 0.05)',
    sm: '0 1px 2px rgb(18 26 21 / 0.04), 0 2px 8px rgb(18 26 21 / 0.05)',
    md: '0 4px 12px rgb(18 26 21 / 0.08), 0 16px 32px -12px rgb(18 26 21 / 0.16)',
    lg: '0 24px 56px -12px rgb(18 26 21 / 0.28)',
    xl: '0 24px 56px -12px rgb(18 26 21 / 0.28)',
};

/** Default shadow elevation scale (dark) – must match @ottabase/ui styles/ui.css .dark */
export const DEFAULT_SHADOWS_DARK: Record<string, string> = {
    xs: '0 1px 2px rgb(0 0 0 / 0.32)',
    sm: '0 1px 2px rgb(0 0 0 / 0.3), 0 2px 8px rgb(0 0 0 / 0.26)',
    md: '0 4px 12px rgb(0 0 0 / 0.36), 0 16px 32px -12px rgb(0 0 0 / 0.6)',
    lg: '0 24px 56px -12px rgb(0 0 0 / 0.7)',
    xl: '0 24px 56px -12px rgb(0 0 0 / 0.7)',
};

/**
 * Default motion: three durations, one curve. Controls answer in 120ms, page
 * content enters in 360ms, the theme eases every colour for 320ms when it flips.
 * Nothing bounces; exits are linear and shorter.
 */
export const DEFAULT_MOTION: ResolvedMotion = {
    durationFast: '120ms',
    durationNormal: '200ms',
    durationSlow: '360ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easingEnter: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easingExit: 'cubic-bezier(0.4, 0, 1, 1)',
    easingSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    disableAnimations: false,
    durations: { theme: '320ms' },
};

/** Default cursor map */
export const DEFAULT_CURSORS: TokenCursors = {
    default: 'auto',
    pointer: 'pointer',
    text: 'text',
};

/** Default spacing tokens: a 4px grid. */
export const DEFAULT_SPACING: TokenSpacing = {
    section: '2rem',
    card: '1.25rem',
    element: '0.5rem',
};

/**
 * Default typography: Inter for everything read, JetBrains Mono for everything
 * copied (keys, ids, env names, cron expressions, versions, CLI lines).
 * heading/body/handwriting/mono are ALWAYS present after resolution; themes
 * may add arbitrary extra roles (display, ticker, …) → --font-{role}.
 */
export const DEFAULT_TYPOGRAPHY: TokenTypographyRoles = {
    heading: {
        fontFamily: 'Inter',
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    },
    body: {
        fontFamily: 'Inter',
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    },
    handwriting: {
        fontFamily: 'Indie Flower',
        url: 'https://fonts.googleapis.com/css2?family=Indie+Flower&display=swap',
    },
    mono: {
        fontFamily: 'JetBrains Mono',
        url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap',
    },
};

/**
 * System-font stacks used when a kit disables custom fonts (`disabled.fonts`).
 * No `url` fields → zero web-font downloads, no FOUC.
 */
export const SYSTEM_TYPOGRAPHY: TokenTypographyRoles = {
    heading: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    body: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    handwriting: { fontFamily: 'cursive' },
    mono: { fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
};

/**
 * Built-in default BrandTheme used when no theme is registered.
 * Used by brandSettingsToConfig for resolveTheme base.
 */
export const DEFAULT_BRAND_THEME: BrandTheme = {
    name: 'verdant',
    tokens: {
        color: {
            light: DEFAULT_COLORS_LIGHT,
            dark: DEFAULT_COLORS_DARK,
        },
        typography: DEFAULT_TYPOGRAPHY,
        spacing: DEFAULT_SPACING,
        radius: '0.5rem',
        shadow: {
            light: DEFAULT_SHADOWS,
            dark: DEFAULT_SHADOWS_DARK,
        },
        motion: DEFAULT_MOTION,
    },
    layout: undefined,
    cursors: DEFAULT_CURSORS,
};
