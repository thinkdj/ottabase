// ============================================================
// @ottabase/brand-engine/dom — browser-only theme application
// ============================================================
// These functions write <style>/<link> elements into `document`. They live on their own
// subpath so the package root stays free of DOM globals: Workers import the root to build the
// same critical CSS server-side (css-critical.ts) and must not type-check against the DOM.

import { buildBrandStylesheet } from './css-runtime';
import { buildEffectsCSS } from './effects';
import type { ResolvedBrandTheme } from './resolver';

/** Set of font URLs already injected to avoid duplicate <link> tags */
const injectedFontUrls = new Set<string>();

/**
 * Injects a Google Fonts (or any external) stylesheet link into <head>.
 * Deduplicates by URL.
 */
export function injectFont(url: string): void {
    if (typeof document === 'undefined') return; // SSR guard
    if (injectedFontUrls.has(url)) return;

    // Check if the font is already in the DOM (iterating to avoid unsafe selector)
    const links = document.getElementsByTagName('link');
    for (let i = 0; i < links.length; i++) {
        if (links[i].href === url && links[i].rel === 'stylesheet') {
            injectedFontUrls.add(url);
            return;
        }
    }

    const linkEl = document.createElement('link');
    linkEl.href = url;
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);
    injectedFontUrls.add(url);
}

/** Create-or-update a <style> element by id and set its CSS text. */
export function upsertStyleElement(id: string, css: string): void {
    if (typeof document === 'undefined') return; // SSR guard
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
}

/**
 * Convenience function: applies a resolved theme's CSS vars + fonts + effects.
 *
 * This is the main runtime entry point for browser environments. It REPLACES
 * the text of <style id="brand-critical"> / <style id="brand-effects"> (the
 * same elements the edge injects) instead of writing inline styles on <html>,
 * so `.dark` re-binding cascades naturally and theme/effects/custom CSS never
 * fight inline-style specificity.
 *
 * Pass both palettes for full dual-mode emission — mode toggling then needs
 * no JS re-application at all. With only `theme`, a single :root block is
 * written (current-mode-only, e.g. admin preview iframes).
 */
export function applyBrandTheme(theme: ResolvedBrandTheme, darkTheme?: ResolvedBrandTheme): void {
    if (typeof document === 'undefined') return; // SSR guard

    // Inject font stylesheets for every typography role URL (both modes)
    const fontUrls = new Set<string>();
    for (const t of [theme, darkTheme]) {
        if (!t?.typography) continue;
        for (const settings of Object.values(t.typography)) {
            if (settings?.url) fontUrls.add(settings.url);
        }
    }
    fontUrls.forEach(injectFont);

    upsertStyleElement('brand-critical', buildBrandStylesheet(theme, darkTheme));
    upsertStyleElement('brand-effects', buildEffectsCSS(theme));
}
