// ============================================================
// @ottabase/discover/next: the App Router half
// ============================================================
// Three pieces for a Next.js app: the robots rules in the shape `app/robots.ts` returns, a
// GET handler for `app/.well-known/otta.json/route.ts`, and the JSON-LD script as a server
// component. The sitemap needs nothing from here: `app/sitemap.ts` already returns entries
// and Next writes the XML. Next itself is not imported, so the package needs no Next
// dependency; the shapes are structural.
// ============================================================

import { sanitizeJsonForScript } from '@ottabase/utils/sanitize';
import type { ProductFacts } from './facts';
import { jsonLd } from './json-ld';
import { isOwnerKey, OWNER_KEY_PARAM, ottaJsonResponse } from './responses';
import { robotsRules, type RobotsOptions, type RobotsRules } from './robots';

type Awaitable<T> = T | Promise<T>;

/** `app/robots.ts`: `export default async () => discoverRobots({ sitemap, disallow: ['/api/'] })`. */
export const discoverRobots = (opts: RobotsOptions = {}): RobotsRules => robotsRules(opts);

/**
 * `app/.well-known/otta.json/route.ts`: `export const GET = ottaJsonHandler(loadFacts)`.
 * `load` returns the product's facts, or null while the site has none (the handler answers 404). `owner` gives the
 * owner keys (env vars, one per consumer): `?key=<one>` then serves the owner scope, with neverClaim and the brief
 * in. `visibility` 'private' answers 404 to anyone without a key.
 */
export const ottaJsonHandler =
    (
        load: (req: Request) => Awaitable<ProductFacts | null>,
        owner?: (req: Request) => Awaitable<string | readonly string[] | null | undefined>,
        visibility: 'public' | 'private' = 'public',
    ) =>
    async (req: Request): Promise<Response> => {
        const given = new URL(req.url).searchParams.get(OWNER_KEY_PARAM);
        const own = given && owner ? isOwnerKey(given, await owner(req)) : false;
        if (!own && visibility === 'private') return ottaJsonResponse(null, req.url);
        return ottaJsonResponse(await load(req), req.url, {
            scope: own ? 'owner' : 'public',
            ifNoneMatch: req.headers.get('if-none-match'),
        });
    };

/** Organization, WebSite and SoftwareApplication as one `<script type="application/ld+json">`, on the home page. */
export function ProductJsonLd({ facts }: { facts: ProductFacts }) {
    // Serialized with the sanitizer the repo mandates for inline JSON scripts, so no fact can close the tag.
    return (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sanitizeJsonForScript(jsonLd(facts)) }} />
    );
}
