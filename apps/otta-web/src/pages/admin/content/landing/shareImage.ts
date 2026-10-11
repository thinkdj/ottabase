// The social image, drawn in the browser with the package's drawShareCard. The editor's live
// preview and the uploaded PNG come from the same function, so what you see is what gets shared.

import { api, getErrorMessage } from '@/lib/api';
import {
    drawShareCard,
    SHARE_CARD_SIZE,
    themeAccent,
    themeFonts,
    type ShareCard,
    type SiteSettings,
} from '@ottabase/ottalanding';

/** What an empty heading / supporting text falls back to: the page's title, or the site's name. */
export type ShareDefaults = { heading: string; subtext?: string };

/** The card's color when it has none of its own: the brand color, else the theme's accent. */
export const cardColor = (card: ShareCard | undefined, site: SiteSettings) =>
    card?.color || site.brandColor || themeAccent(site.theme);

const images = new Map<string, Promise<HTMLImageElement>>();

/** An image the canvas may read back: same origin, or served with CORS. Cached per URL. */
function loadImage(url: string): Promise<HTMLImageElement> {
    let image = images.get(url);
    if (!image) {
        image = new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
                images.delete(url);
                reject(new Error(url));
            };
            img.src = url;
        });
        images.set(url, image);
    }
    return image;
}

/** The theme's web fonts, loaded before drawing (a canvas can't wait for them on its own). */
async function loadFonts(themeId: string) {
    const fonts = themeFonts(themeId);
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')];
    const sheets = fonts.urls.map((href) => {
        let link = links.find((l) => l.href === href);
        if (!link) {
            link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
            document.head.appendChild(link);
        }
        // fonts.load() only knows faces whose stylesheet has arrived; until then it resolves empty.
        const pending = link;
        return pending.sheet
            ? undefined
            : new Promise((resolve) => {
                  pending.addEventListener('load', resolve, { once: true });
                  pending.addEventListener('error', resolve, { once: true });
              });
    });
    // A slow font network must never block the editor: after 3s, draw with the fallback.
    await Promise.race([
        Promise.all(sheets).then(() =>
            Promise.all([
                document.fonts.load(`700 76px "${fonts.heading}"`),
                document.fonts.load(`400 32px "${fonts.body}"`),
            ]),
        ),
        new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    return fonts;
}

function hostOf(url?: string): string | undefined {
    try {
        return url ? new URL(url).host : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Draw the card onto `canvas`. Images that can't be used (missing, or on a host that blocks
 * reading them back) are left out, and returned as warnings for the editor to show.
 */
export async function paintShareCard(
    canvas: HTMLCanvasElement,
    card: ShareCard | undefined,
    site: SiteSettings,
    defaults: ShareDefaults,
): Promise<string[]> {
    const warnings: string[] = [];
    const optional = (url: string | undefined, what: string) =>
        url
            ? loadImage(url).catch(() => {
                  warnings.push(`The ${what} can’t be drawn. Upload it to the media library and pick it from there.`);
                  return undefined;
              })
            : undefined;
    const [fonts, background, logo] = await Promise.all([
        loadFonts(site.theme),
        optional(card?.backgroundUrl, 'background image'),
        optional(site.logoUrl, 'logo'),
    ]);
    canvas.width = SHARE_CARD_SIZE.width;
    canvas.height = SHARE_CARD_SIZE.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return ['This browser can’t draw the social image.'];
    drawShareCard(ctx, {
        heading: card?.heading || defaults.heading,
        subtext: card?.subtext || defaults.subtext,
        color: cardColor(card, site),
        background,
        logo,
        siteName: site.name,
        domain: hostOf(site.siteUrl),
        fonts,
    });
    return warnings;
}

/**
 * Render the card and store it as the social image of `target` (`site` or a page id).
 * Returns the card with its new `imageUrl`.
 */
export async function publishShareCard(
    target: string,
    card: ShareCard | undefined,
    site: SiteSettings,
    defaults: ShareDefaults,
): Promise<ShareCard> {
    const canvas = document.createElement('canvas');
    await paintShareCard(canvas, card, site, defaults);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The social image could not be rendered.');
    const form = new FormData();
    form.append('file', new File([blob], 'share.png', { type: 'image/png' }));
    form.append('target', target);
    const { url } = await api<{ url: string }>('/api/landing/share-image', { method: 'POST', body: form });
    return { ...card, imageUrl: url };
}

/**
 * The site settings with a freshly rendered default social image (site name over the brand
 * color, unless the card says otherwise). Never fails a save: a render or upload problem comes
 * back as `warning`, and the previous image stays.
 */
export async function withSiteShareImage(site: SiteSettings): Promise<{ site: SiteSettings; warning?: string }> {
    try {
        const share = await publishShareCard('site', site.share, site, { heading: site.name, subtext: site.tagline });
        return { site: { ...site, share } };
    } catch (error) {
        return { site, warning: notUpdated(error) };
    }
}

/** The page with its own social image re-rendered (title and description are its defaults); same rules. */
export async function withPageShareImage<P extends { title: string; description: string; share?: ShareCard }>(
    pageId: string,
    page: P,
    site: SiteSettings,
): Promise<{ page: P; warning?: string }> {
    if (!page.share) return { page };
    try {
        const share = await publishShareCard(pageId, page.share, site, {
            heading: page.title,
            subtext: page.description,
        });
        return { page: { ...page, share } };
    } catch (error) {
        return { page, warning: notUpdated(error) };
    }
}

const notUpdated = (error: unknown) => `Saved, but the social image couldn’t be updated: ${getErrorMessage(error)}`;
