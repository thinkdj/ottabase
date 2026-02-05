import { CURSOR_SVG_REGISTRY } from '../config/cursors.registry';
import type { ThemeConfig } from '../config/theme.types';
import artisanTheme from '../config/themes/artisan.json';
import crispTheme from '../config/themes/crisp.json';
import defaultTheme from '../config/themes/default.json';
import funkyTheme from '../config/themes/funky.json';
import midnightTheme from '../config/themes/midnight.json';
import neoTheme from '../config/themes/neo.json';
import roseTheme from '../config/themes/rose.json';
import verdantTheme from '../config/themes/verdant.json';

// ---------------------------------------------------------------------------
// Theme catalogue – every bundled theme is registered here
// ---------------------------------------------------------------------------
const themes: Record<string, ThemeConfig> = {
    default: defaultTheme as ThemeConfig,
    neo: neoTheme as ThemeConfig,
    crisp: crispTheme as ThemeConfig,
    funky: funkyTheme as ThemeConfig,
    artisan: artisanTheme as ThemeConfig,
    midnight: midnightTheme as ThemeConfig,
    rose: roseTheme as ThemeConfig,
    verdant: verdantTheme as ThemeConfig,
};

/** Returns list of all registered theme identifiers */
export const getAvailableThemes = (): string[] => Object.keys(themes);

/** Resolves a theme by name with fallback to default */
export const getTheme = (themeName: string): ThemeConfig => {
    return themes[themeName] ?? themes['default'];
};

// ---------------------------------------------------------------------------
// Helpers — font injection, CSS variable writes, cursor processing
// ---------------------------------------------------------------------------

/** Set of font URLs already injected to avoid duplicate <link> tags */
const injectedFontUrls = new Set<string>();

const injectFont = (url: string) => {
    if (injectedFontUrls.has(url)) return;
    if (document.querySelector(`link[href="${url}"]`)) {
        injectedFontUrls.add(url);
        return;
    }
    const linkEl = document.createElement('link');
    linkEl.href = url;
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);
    injectedFontUrls.add(url);
};

const rootStyle = () => document.documentElement.style;
const setVar = (prop: string, val: string) => rootStyle().setProperty(prop, val);

/** Encode an SVG string into a CSS-safe data-URI cursor value */
const svgToCursorUri = (svg: string): string => {
    const encoded = encodeURIComponent(svg.trim());
    return `url("data:image/svg+xml;utf8,${encoded}"), auto`;
};

/**
 * Resolves a cursor config value to a CSS cursor declaration.
 * Accepts plain CSS keywords, registry refs (`registry:<key>`),
 * inline SVG (`svg:<markup>`), or raw URLs.
 */
const resolveCursor = (value: string): string => {
    if (!value) return 'auto';

    // Plain CSS keyword (auto, pointer, text …)
    if (!value.includes(':') && !value.includes('(')) return value;

    // Registry lookup
    if (value.startsWith('registry:')) {
        const registryKey = value.slice(9);
        const svgMarkup = CURSOR_SVG_REGISTRY[registryKey];
        if (svgMarkup) return svgToCursorUri(svgMarkup);
        if (import.meta.env.DEV) console.warn(`[theme] Cursor registry miss: "${registryKey}"`);
        return 'auto';
    }

    // Inline SVG
    if (value.startsWith('svg:')) return svgToCursorUri(value.slice(4));

    // Explicit url() or bare http(s) reference
    if (value.startsWith('url(')) return value;
    if (value.startsWith('http')) return `url(${value}), auto`;

    return value;
};

// ---------------------------------------------------------------------------
// Default fallback values for shadow & motion tokens
// ---------------------------------------------------------------------------
const SHADOW_DEFAULTS = {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

const MOTION_DEFAULTS = {
    durationFast: '100ms',
    durationNormal: '200ms',
    durationSlow: '400ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easingEnter: 'cubic-bezier(0, 0, 0.2, 1)',
    easingExit: 'cubic-bezier(0.4, 0, 1, 1)',
};

const CURSOR_DEFAULTS: Record<string, string> = {
    default: 'auto',
    pointer: 'pointer',
    text: 'text',
};

// ---------------------------------------------------------------------------
// Main apply function
// ---------------------------------------------------------------------------

/**
 * Applies a named theme + mode to the document root.
 *
 * Handles: typography (font injection + CSS vars), colour tokens,
 * border-radius, spacing, shadow elevations, motion presets, and cursors.
 */
export const applyTheme = (themeName: string, mode: 'light' | 'dark' = 'light') => {
    const theme = getTheme(themeName);

    if (import.meta.env.DEV) {
        console.log(`[theme] Applying "${themeName}" in ${mode} mode`);
    }

    // -- Typography ----------------------------------------------------------
    const { heading, body, handwriting } = theme.typography;
    const fontUrls = new Set([heading.url, body.url, handwriting.url].filter(Boolean) as string[]);
    fontUrls.forEach(injectFont);

    setVar('--font-heading', heading.fontFamily);
    setVar('--font-body', body.fontFamily);
    setVar('--font-handwriting', handwriting.fontFamily);

    // -- Colour tokens -------------------------------------------------------
    const palette = theme.colors[mode];
    for (const [token, hslValue] of Object.entries(palette)) {
        setVar(`--${token}`, hslValue);
    }

    // -- Border radius -------------------------------------------------------
    if (theme.radius) {
        setVar('--radius', theme.radius);
    }

    // -- Spacing overrides ---------------------------------------------------
    if (theme.spacing) {
        for (const [key, val] of Object.entries(theme.spacing)) {
            setVar(`--spacing-${key}`, val);
        }
    }

    // -- Shadow elevation scale ----------------------------------------------
    const shadows = { ...SHADOW_DEFAULTS, ...theme.shadows };
    for (const [level, val] of Object.entries(shadows)) {
        setVar(`--shadow-${level}`, val);
    }

    // -- Motion / transition presets -----------------------------------------
    const motion = { ...MOTION_DEFAULTS, ...theme.motion };
    setVar('--duration-fast', motion.durationFast);
    setVar('--duration-normal', motion.durationNormal);
    setVar('--duration-slow', motion.durationSlow);
    setVar('--ease', motion.easing);
    setVar('--ease-enter', motion.easingEnter);
    setVar('--ease-exit', motion.easingExit);

    // -- Cursors -------------------------------------------------------------
    const cursorMap = theme.appearance?.cursors ?? CURSOR_DEFAULTS;
    for (const [state, raw] of Object.entries(cursorMap)) {
        if (raw !== undefined) {
            setVar(`--cursor-${state}`, resolveCursor(raw));
        }
    }
};
