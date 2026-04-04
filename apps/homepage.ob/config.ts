/**
 * Root marketing-site config. Change `THEME` to switch the entire UI between the original
 * homepage.ob look (`classic`) and homepage.ob.1 “Signal Horizon” (`signalHorizon`).
 */
export type SiteThemeId = 'classic' | 'signalHorizon';

/** Toggle site appearance here (rebuild to apply). */
export const THEME: SiteThemeId = 'signalHorizon';

export type SiteConfig = {
    theme: SiteThemeId;
    colorModeStorageKey: string;
    themeColor: { light: string; dark: string };
};

const PRESETS: Record<SiteThemeId, Omit<SiteConfig, 'theme'>> = {
    classic: {
        colorModeStorageKey: 'hp-ob-theme',
        themeColor: { light: '#fafaf9', dark: '#09090b' },
    },
    signalHorizon: {
        colorModeStorageKey: 'hp-theme',
        themeColor: { light: '#f6f2ea', dark: '#030306' },
    },
};

export const siteConfig: SiteConfig = {
    theme: THEME,
    ...PRESETS[THEME],
};
