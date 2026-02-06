import {
    type BrandTheme,
    type LegacyThemeConfig,
    type ResolvedBrandTheme,
    fromLegacyThemeConfig,
    resolveTheme,
    applyBrandTheme,
    registerThemes,
    getThemeOrDefault,
    getRegisteredThemeNames,
} from '@ottabase/brand-engine';
import { CURSOR_SVG_REGISTRY } from '../config/cursors.registry';

// -- Legacy theme JSON imports -----------------------------------------------
import artisanTheme from '../config/themes/artisan.json';
import crispTheme from '../config/themes/crisp.json';
import defaultTheme from '../config/themes/default.json';
import funkyTheme from '../config/themes/funky.json';
import midnightTheme from '../config/themes/midnight.json';
import neoTheme from '../config/themes/neo.json';
import roseTheme from '../config/themes/rose.json';
import verdantTheme from '../config/themes/verdant.json';

// ---------------------------------------------------------------------------
// Convert legacy JSON themes to BrandTheme and register in the BrandEngine
// ---------------------------------------------------------------------------
const legacyThemes: LegacyThemeConfig[] = [
    defaultTheme,
    neoTheme,
    crispTheme,
    funkyTheme,
    artisanTheme,
    midnightTheme,
    roseTheme,
    verdantTheme,
] as LegacyThemeConfig[];

const brandThemes: BrandTheme[] = legacyThemes.map((t) => fromLegacyThemeConfig(t));
registerThemes(brandThemes);

// ---------------------------------------------------------------------------
// Public API – delegates to BrandEngine
// ---------------------------------------------------------------------------

/** Returns list of all registered theme identifiers */
export const getAvailableThemes = (): string[] => getRegisteredThemeNames();

/** Resolves a theme by name with fallback to default */
export const getTheme = (themeName: string): BrandTheme => getThemeOrDefault(themeName);

// ---------------------------------------------------------------------------
// Cursor resolution helpers (re-used from existing system)
// ---------------------------------------------------------------------------

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
// Main apply function – now powered by BrandEngine
// ---------------------------------------------------------------------------

/**
 * Applies a named theme + mode to the document root.
 *
 * Handles: typography (font injection + CSS vars), colour tokens,
 * border-radius, spacing, shadow elevations, motion presets, layout vars,
 * and cursors.
 *
 * Returns the resolved theme for use in providers / context.
 */
export const applyTheme = (themeName: string, mode: 'light' | 'dark' = 'light'): ResolvedBrandTheme => {
    const base = getThemeOrDefault(themeName);

    if (import.meta.env.DEV) {
        console.log(`[theme] Applying "${themeName}" in ${mode} mode`);
    }

    // Resolve the full theme (merge defaults + mode selection + aliases)
    const resolved = resolveTheme({ base, mode });

    // Inject fonts + CSS vars via BrandEngine runtime
    applyBrandTheme(resolved);

    // -- Cursor post-processing (registry / SVG resolution) ------------------
    // BrandEngine writes raw cursor values; we resolve them through the
    // cursor registry specific to this app.
    if (resolved.cursors) {
        const rootStyle = document.documentElement.style;
        for (const [state, raw] of Object.entries(resolved.cursors)) {
            if (raw !== undefined) {
                rootStyle.setProperty(`--cursor-${state}`, resolveCursor(raw));
            }
        }
    }

    return resolved;
};
