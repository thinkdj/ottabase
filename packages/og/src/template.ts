// ============================================================
// @ottabase/og — the default card as HTML
// ============================================================
// One page, 1200 by 630, no scripts, no external CSS: a band of the accent color on top, an
// eyebrow, the title at a size that fits its length, a subtitle, and a footer with the logo,
// the site and the author. Fonts are the system's unless the renderer adds a `@font-face`.
// An app that wants its own look passes another `OgTemplate`; Ottabase Pro's og-studio edits
// one visually and hands the result here.
// ============================================================

import { httpUrl, isColor, OG_SIZE, type OgCard } from './card';

/** Renders a card to a complete HTML document. */
export type OgTemplate = (card: OgCard) => string;

/** Bump when the default template's output changes, so cached images are drawn again. */
export const TEMPLATE_VERSION = 'default-1';

export interface OgTemplateOptions {
    /** CSS prepended to the page: an `@font-face` or an `@import` of a web font. */
    fontCss?: string;
    /** The font stack, when `fontCss` brings one. */
    fontFamily?: string;
}

const SYSTEM_FONT = '-apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Title size by length: a headline fills the width, a long one still fits in three lines. */
export function titleSize(title: string): number {
    if (title.length <= 36) return 80;
    if (title.length <= 72) return 64;
    if (title.length <= 120) return 52;
    return 42;
}

/** The default template, with its options bound. */
export function createOgTemplate(options: OgTemplateOptions = {}): OgTemplate {
    const family = options.fontFamily ? `${options.fontFamily}, ${SYSTEM_FONT}` : SYSTEM_FONT;
    return (card) => {
        const dark = card.theme !== 'light';
        const accent = card.accent && isColor(card.accent) ? card.accent : '#2563eb';
        const background = card.background && isColor(card.background) ? card.background : dark ? '#0b1220' : '#ffffff';
        const ink = dark ? '#f8fafc' : '#0f172a';
        const muted = dark ? 'rgba(248, 250, 252, 0.72)' : 'rgba(15, 23, 42, 0.66)';
        const image = httpUrl(card.imageUrl);
        const logo = httpUrl(card.logoUrl);
        const footer = [card.siteName, card.domain].filter(Boolean).map((value) => escapeHtml(value!));
        const byline = [card.author, card.date].filter(Boolean).map((value) => escapeHtml(value!));
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${options.fontCss ?? ''}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${OG_SIZE.width}px; height: ${OG_SIZE.height}px; overflow: hidden; }
body {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 72px 80px 64px;
    background: ${background};
    color: ${ink};
    font-family: ${family};
    -webkit-font-smoothing: antialiased;
}
.band { position: absolute; top: 0; left: 0; right: 0; height: 14px; background: ${accent}; }
.image { position: absolute; inset: 0; background: url("${image ?? ''}") center / cover no-repeat; }
.shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.75)); }
.body { position: relative; }
.eyebrow { color: ${image ? '#ffffff' : accent}; font-size: 26px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 28px; }
.title { font-size: ${titleSize(card.title)}px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.subtitle { margin-top: 24px; font-size: 32px; line-height: 1.35; color: ${image ? 'rgba(255, 255, 255, 0.85)' : muted}; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.footer { position: relative; display: flex; align-items: center; justify-content: space-between; font-size: 26px; color: ${image ? 'rgba(255, 255, 255, 0.9)' : muted}; }
.site { display: flex; align-items: center; gap: 20px; }
.site img { height: 56px; width: auto; max-width: 240px; object-fit: contain; }
.site b { color: ${image ? '#ffffff' : ink}; font-weight: 600; }
</style>
</head>
<body${image ? ' style="color: #ffffff"' : ''}>
${image ? '<div class="image"></div><div class="shade"></div>' : '<div class="band"></div>'}
<div class="body">
${card.eyebrow ? `<div class="eyebrow">${escapeHtml(card.eyebrow)}</div>` : ''}
<h1 class="title">${escapeHtml(card.title)}</h1>
${card.subtitle ? `<p class="subtitle">${escapeHtml(card.subtitle)}</p>` : ''}
</div>
<div class="footer">
<div class="site">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ''}${footer.length ? `<span><b>${footer[0]}</b>${footer[1] ? ` <span>${footer[1]}</span>` : ''}</span>` : ''}</div>
${byline.length ? `<div>${byline.join(' · ')}</div>` : ''}
</div>
</body>
</html>`;
    };
}

/** The default template with system fonts. */
export const renderOgHtml: OgTemplate = createOgTemplate();
