// The three files as HTTP responses, shared by the Worker manifest and the Next.js handler so
// both say the same headers: an hour for robots and the sitemap, five minutes and any origin
// for otta.json (Ottabuzz and Imageine read it from the browser).

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { ProductFacts } from './facts';
import { ottaJson } from './otta-json';
import { robotsTxt, type RobotsOptions } from './robots';
import { sitemapXml, type SitemapEntry } from './sitemap';

const text = (body: string, type: string, maxAge: number): Response =>
    new Response(body, {
        headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': `public, max-age=${maxAge}` },
    });

export const robotsResponse = (opts: RobotsOptions = {}): Response => text(robotsTxt(opts), 'text/plain', 3600);

export const sitemapResponse = (entries: SitemapEntry[]): Response =>
    text(sitemapXml(entries), 'application/xml', 3600);

/** otta.json for `facts`, or a 404 when the product has no facts yet. `from` is the request URL; its query is dropped. */
export function ottaJsonResponse(facts: ProductFacts | null, from: string): Response {
    if (!facts) return errorResponse('No product facts yet.', 404, { code: 'NOT_FOUND' });
    const url = new URL(from);
    url.search = '';
    url.hash = '';
    return jsonResponse(ottaJson(facts, { from: url.href }), 200, {
        headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
    });
}
