import { ThemeConfig } from '../config/theme.types';
import defaultTheme from '../config/themes/default.json';
import neoTheme from '../config/themes/neo.json';
import crispTheme from '../config/themes/crisp.json';
import funkyTheme from '../config/themes/funky.json';
import artisanTheme from '../config/themes/artisan.json';

// Registry of available themes
const themes: Record<string, ThemeConfig> = {
    default: defaultTheme as ThemeConfig,
    neo: neoTheme as ThemeConfig,
    crisp: crispTheme as ThemeConfig,
    funky: funkyTheme as ThemeConfig,
    artisan: artisanTheme as ThemeConfig,
};

export const getAvailableThemes = () => Object.keys(themes);

export const getTheme = (themeName: string): ThemeConfig => {
    return themes[themeName] || themes['default'];
};

const injectFont = (url: string) => {
    if (!document.querySelector(`link[href="${url}"]`)) {
        const link = document.createElement('link');
        link.href = url;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
};

const setCSSVariable = (property: string, value: string) => {
    document.documentElement.style.setProperty(property, value);
};

export const applyTheme = (themeName: string, mode: 'light' | 'dark' = 'light') => {
    const theme = getTheme(themeName);
    console.log(`Applying theme: ${themeName}`, theme);

    // 1. Apply Typography
    if (theme.typography.heading.url) {
        injectFont(theme.typography.heading.url);
    }
    if (theme.typography.body.url && theme.typography.body.url !== theme.typography.heading.url) {
        injectFont(theme.typography.body.url);
    }
    if (theme.typography.handwriting.url) {
        injectFont(theme.typography.handwriting.url);
    }
    setCSSVariable('--font-heading', theme.typography.heading.fontFamily);
    setCSSVariable('--font-body', theme.typography.body.fontFamily);
    setCSSVariable('--font-handwriting', theme.typography.handwriting.fontFamily);

    // 2. Apply Colors
    const colors = theme.colors[mode];
    Object.entries(colors).forEach(([key, value]) => {
        // Convert HSL values if they are stored as "H S L" or just allow raw values
        // Assuming config has "H S% L%" or similar that matches Tailwind expectation
        // Tailwind usually expects just the numbers if using withOpacity protocol, 
        // but here we are simplistic. We will assume the config has the full value 
        // OR we standardize on "H S% L%" for easier tailwind integration.
        // Let's assume the config provides valid CSS color values or properly formatted HSL channels.
        // For specific tailwind compatibility with <alpha-value>, having just channels is best.
        setCSSVariable(`--${key}`, value);
    });

    // 3. Apply Radius
    if (theme.radius) {
        setCSSVariable('--radius', theme.radius);
    }

    // 4. Apply Spacing (if any custom spacing overrides exist)
    if (theme.spacing) {
        Object.entries(theme.spacing).forEach(([key, value]) => {
            setCSSVariable(`--spacing-${key}`, value);
        });
    }
};
