// ============================================================
// @ottabase/og — the routes
// ============================================================
//   GET /image?title=…&sig=…    the PNG; public, signed (see sign.ts)
//   GET /preview?title=…&sig=…  the same card as HTML, for a look at the template
//
// The signature covers the fields in the URL. The defaults (site name, domain, brand colors,
// logo) are added after it is checked, so the URL stays short and the brand can change without
// every emitted URL changing with it.
// ============================================================

import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { cardFromParams, type OgCard } from './card';
import type { OgRenderer, OgTemplateChoice } from './renderer';
import { SIGNATURE_PARAM, verifyCard } from './sign';

/** Picks the template for one card; null means the renderer's own. */
export type OgTemplateSource<Env> = (
    env: Env,
    request: Request,
    card: OgCard,
) => OgTemplateChoice | null | Promise<OgTemplateChoice | null>;

let registered: OgTemplateSource<never> | null = null;

/**
 * Lets another package choose templates without the app wiring it: og-studio registers its
 * source when its composition loads, and the routes ask it before falling back to the
 * renderer's own template. One slot: the last registration wins.
 */
export function registerOgTemplateSource<Env>(source: OgTemplateSource<Env> | null): void {
    registered = source as OgTemplateSource<never> | null;
}

export interface OgRouterOptions<Env> {
    /** The renderer for this request, or null when the app has no Browser Rendering binding. */
    renderer: (env: Env) => OgRenderer | null;
    /** Chooses a template per request; the registered source when not given. */
    templates?: OgTemplateSource<Env>;
    /** The signing secret; null and the route answers 503 unless `open`. */
    secret: (env: Env) => string | null | undefined;
    /** Serve unsigned requests too: local development, or an app that accepts the cost. Default false. */
    open?: boolean;
    /** Fields a card gets when the URL does not carry them. */
    defaults?: (env: Env, request: Request) => Partial<OgCard> | Promise<Partial<OgCard>>;
    /** Seconds browsers and the edge may keep the image. Default one day. */
    maxAge?: number;
}

export function createOgRouter<Env>(options: OgRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const maxAge = options.maxAge ?? 86_400;

    /** The card of a request, verified and completed, or the response that refuses it. */
    const cardOf = async (request: Request, env: Env): Promise<OgCard | Response> => {
        const url = new URL(request.url);
        const parsed = cardFromParams(url.searchParams);
        if ('error' in parsed) return errorResponse(parsed.error, 400, { code: 'BAD_CARD' });
        if (!options.open) {
            const secret = options.secret(env);
            if (!secret) return errorResponse('Social images are not configured', 503, { code: 'OG_UNAVAILABLE' });
            if (!(await verifyCard(secret, parsed.card, url.searchParams.get(SIGNATURE_PARAM)))) {
                return errorResponse('Bad signature', 403, { code: 'BAD_SIGNATURE' });
            }
        }
        const defaults = (await options.defaults?.(env, request)) ?? {};
        const card: Record<string, unknown> = { ...parsed.card };
        for (const [field, value] of Object.entries(defaults)) if (value && !card[field]) card[field] = value;
        return card as unknown as OgCard;
    };

    const choiceOf = async (env: Env, request: Request, card: OgCard): Promise<OgTemplateChoice | undefined> => {
        const source = options.templates ?? (registered as OgTemplateSource<Env> | null);
        return (await source?.(env, request, card)) ?? undefined;
    };

    router.get('/image', async (c) => {
        const card = await cardOf(c.req, c.env);
        if (card instanceof Response) return card;
        const renderer = options.renderer(c.env);
        if (!renderer) return errorResponse('Browser Rendering is not bound', 503, { code: 'OG_UNAVAILABLE' });
        const result = await renderer.render(card, await choiceOf(c.env, c.req, card));
        if (!result.ok) return errorResponse('The image could not be rendered', 502, { code: 'OG_RENDER_FAILED' });
        return new Response(result.value.png, {
            headers: {
                'content-type': 'image/png',
                'cache-control': `public, max-age=${maxAge}`,
                'x-og-cache': result.value.cached ? 'hit' : 'miss',
            },
        });
    });

    router.get('/preview', async (c) => {
        const card = await cardOf(c.req, c.env);
        if (card instanceof Response) return card;
        const renderer = options.renderer(c.env);
        if (!renderer) return errorResponse('Browser Rendering is not bound', 503, { code: 'OG_UNAVAILABLE' });
        return new Response(renderer.html(card, await choiceOf(c.env, c.req, card)), {
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        });
    });

    return router;
}
