// ============================================================
// @ottabase/og — HTML to PNG, once per card
// ============================================================
// Browser Rendering draws the card; R2 keeps the PNG under the card's id, so a post shared a
// thousand times costs one browser session. The id includes the template version: change the
// template, bump the version, and every card is drawn again on its next request while the old
// objects age out under the bucket's own lifecycle rule.
// ============================================================

import { createBrowserClient, type BrowserRunLike } from '@ottabase/cf/browser';
import { cardId, OG_SIZE, type OgCard } from './card';
import { renderOgHtml, TEMPLATE_VERSION, type OgTemplate } from './template';

/** The slice of an R2 bucket the cache needs; the Workers binding satisfies it. */
export interface OgBucket {
    get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
    put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export interface OgRendererOptions {
    browser: BrowserRunLike;
    /** Without a bucket every request renders. */
    bucket?: OgBucket | null;
    /** Key prefix in the bucket. Default `og/`. */
    prefix?: string;
    template?: OgTemplate;
    /** Part of the cache key; the default template's own version unless a custom template names its. */
    version?: string;
    /** Browser time allowed per render, in milliseconds. Default 15 000. */
    timeoutMs?: number;
}

export interface OgRendered {
    png: ArrayBuffer;
    /** True when the PNG came from the bucket. */
    cached: boolean;
}

export interface OgRenderer {
    /** The card as HTML, for a preview. */
    html(card: OgCard, choice?: OgTemplateChoice): string;
    /** The bucket key the card's PNG lives under. */
    key(card: OgCard, choice?: OgTemplateChoice): Promise<string>;
    render(
        card: OgCard,
        choice?: OgTemplateChoice,
    ): Promise<{ ok: true; value: OgRendered } | { ok: false; error: Error }>;
}

/** A template chosen for one request (og-studio's, per org or content type) with the version that keys its cache. */
export interface OgTemplateChoice {
    template: OgTemplate;
    version: string;
}

export function createOgRenderer(options: OgRendererOptions): OgRenderer {
    const client = createBrowserClient({ browser: options.browser });
    const own: OgTemplateChoice = {
        template: options.template ?? renderOgHtml,
        version: options.version ?? TEMPLATE_VERSION,
    };
    const prefix = options.prefix ?? 'og/';
    const bucket = options.bucket ?? null;
    const key = async (card: OgCard, choice = own) => `${prefix}${await cardId(card, choice.version)}.png`;
    return {
        html: (card, choice = own) => choice.template(card),
        key,
        async render(card, choice = own) {
            const objectKey = await key(card, choice);
            const hit = await bucket?.get(objectKey);
            if (hit) return { ok: true, value: { png: await hit.arrayBuffer(), cached: true } };
            const shot = await client.screenshot(
                { html: choice.template(card) },
                {
                    viewport: { width: OG_SIZE.width, height: OG_SIZE.height, deviceScaleFactor: 1 },
                    gotoOptions: { waitUntil: 'networkidle0', timeout: options.timeoutMs ?? 15_000 },
                    screenshotOptions: { type: 'png' },
                },
            );
            if (!shot.success) return { ok: false, error: shot.error };
            const png = shot.data.data;
            await bucket?.put(objectKey, png, { httpMetadata: { contentType: 'image/png' } });
            return { ok: true, value: { png, cached: false } };
        },
    };
}
