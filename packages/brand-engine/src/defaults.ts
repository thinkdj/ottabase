// ---------------------------------------------------------------------------
// BrandEngine – Default token values
// ---------------------------------------------------------------------------

import type { TokenColors, TokenCursors, TokenMotion, TokenShadows, TokenSpacing } from './tokens';

/** Default light-mode colour palette */
export const DEFAULT_COLORS_LIGHT: TokenColors = {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    primary: '221.2 83.2% 53.3%',
    'primary-foreground': '210 40% 98%',
    secondary: '210 40% 96.1%',
    'secondary-foreground': '222.2 47.4% 11.2%',
    muted: '210 40% 96.1%',
    'muted-foreground': '215.4 16.3% 46.9%',
    accent: '210 40% 96.1%',
    'accent-foreground': '222.2 47.4% 11.2%',
    destructive: '0 84.2% 60.2%',
    'destructive-foreground': '210 40% 98%',
    border: '214.3 31.8% 91.4%',
    input: '214.3 31.8% 91.4%',
    ring: '221.2 83.2% 53.3%',
    card: '0 0% 100%',
    'card-foreground': '222.2 84% 4.9%',
    popover: '0 0% 100%',
    'popover-foreground': '222.2 84% 4.9%',
    'sidebar-background': '210 40% 97%',
    'sidebar-foreground': '222.2 47.4% 11.2%',
    'sidebar-border': '214.3 31.8% 91.4%',
    'sidebar-accent': '221.2 83.2% 53.3%',
    'sidebar-accent-foreground': '221.2 83.2% 53.3%',
    'sidebar-ring': '221.2 83.2% 53.3%',
    success: '150 60% 40%',
    'success-foreground': '0 0% 100%',
    warning: '36 86% 50%',
    'warning-foreground': '26 54% 14%',
    info: '206 78% 52%',
    'info-foreground': '0 0% 100%',
    'chart-1': '221.2 83.2% 53.3%',
    'chart-2': '150 60% 40%',
    'chart-3': '36 86% 50%',
    'chart-4': '280 56% 52%',
    'chart-5': '14 78% 54%',
};

/** Default dark-mode colour palette */
export const DEFAULT_COLORS_DARK: TokenColors = {
    background: '222.2 84% 4.9%',
    foreground: '210 40% 98%',
    primary: '217.2 91.2% 59.8%',
    'primary-foreground': '222.2 47.4% 11.2%',
    secondary: '217.2 32.6% 17.5%',
    'secondary-foreground': '210 40% 98%',
    muted: '217.2 32.6% 17.5%',
    'muted-foreground': '215 20.2% 65.1%',
    accent: '217.2 32.6% 17.5%',
    'accent-foreground': '210 40% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '210 40% 98%',
    border: '217.2 32.6% 17.5%',
    input: '217.2 32.6% 17.5%',
    ring: '224.3 76.3% 48%',
    card: '222.2 84% 4.9%',
    'card-foreground': '210 40% 98%',
    popover: '222.2 84% 4.9%',
    'popover-foreground': '210 40% 98%',
    'sidebar-background': '222.2 70% 7%',
    'sidebar-foreground': '215 20.2% 65.1%',
    'sidebar-border': '217.2 32.6% 17.5%',
    'sidebar-accent': '217.2 91.2% 59.8%',
    'sidebar-accent-foreground': '217.2 91.2% 59.8%',
    'sidebar-ring': '217.2 91.2% 59.8%',
    success: '154 56% 48%',
    'success-foreground': '222.2 84% 4.9%',
    warning: '40 82% 56%',
    'warning-foreground': '222.2 84% 4.9%',
    info: '210 74% 58%',
    'info-foreground': '222.2 84% 4.9%',
    'chart-1': '217.2 91.2% 59.8%',
    'chart-2': '154 56% 48%',
    'chart-3': '40 82% 56%',
    'chart-4': '284 52% 58%',
    'chart-5': '18 74% 60%',
};

/** Default shadow elevation scale */
export const DEFAULT_SHADOWS: Required<TokenShadows> = {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

/** Default motion / transition presets */
export const DEFAULT_MOTION: Required<TokenMotion> = {
    durationFast: '100ms',
    durationNormal: '200ms',
    durationSlow: '400ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easingEnter: 'cubic-bezier(0, 0, 0.2, 1)',
    easingExit: 'cubic-bezier(0.4, 0, 1, 1)',
};

/** Default cursor map */
export const DEFAULT_CURSORS: TokenCursors = {
    default: 'auto',
    pointer: 'pointer',
    text: 'text',
};

/** Default spacing tokens */
export const DEFAULT_SPACING: TokenSpacing = {
    section: '2rem',
    card: '1.5rem',
    element: '0.5rem',
};
