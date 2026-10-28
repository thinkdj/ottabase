// The three files as HTTP responses, shared by the Worker manifest and the Next.js handler so
// both say the same headers: an hour for robots and the sitemap, five minutes and any origin
// for otta.json (Ottabuzz and Imageine read it from the browser). otta.json carries its hash
// as the ETag, so a reader that sends it back gets a 304 and no bytes while nothing changed.
// The owner's copy is never cached by anyone in between.

import { ottaJson, type ProductFacts, type Scope } from '@ottabase/context';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { robotsTxt, type RobotsOptions } from './robots';
import { sitemapXml, type SitemapEntry } from './sitemap';

const text = (body: string, type: string, maxAge: number): Response =>
    new Response(body, {
        headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': `public, max-age=${maxAge}` },
    });

export const robotsResponse = (opts: RobotsOptions = {}): Response => text(robotsTxt(opts), 'text/plain', 3600);

export const sitemapResponse = (entries: SitemapEntry[]): Response =>
    text(sitemapXml(entries), 'application/xml', 3600);

export interface OttaJsonResponseOptions {
    /** 'owner' puts the writer-only lines in; the caller has checked the key. */
    scope?: Scope;
    /** The request's If-None-Match, for a 304 when the hash is the same. */
    ifNoneMatch?: string | null;
}

/** The query parameter that carries the owner key. */
export const OWNER_KEY_PARAM = 'key';

/** Whether `given` is one of the owner keys (one per consumer, so one can be revoked alone), each compared in
 *  constant time over its length. */
export function isOwnerKey(
    given: string | null | undefined,
    keys: string | readonly string[] | null | undefined,
): boolean {
    if (!given || !keys) return false;
    return ([] as readonly string[]).concat(keys).some((key) => {
        if (!key || given.length !== key.length) return false;
        let diff = 0;
        for (let i = 0; i < key.length; i++) diff |= given.charCodeAt(i) ^ key.charCodeAt(i);
        return diff === 0;
    });
}

/** otta.json for `facts`, or a 404 when the product has no facts yet. `from` is the request URL; its query is
 *  dropped, so the owner key never appears in the file. */
export function ottaJsonResponse(
    facts: ProductFacts | null,
    from: string,
    opts: OttaJsonResponseOptions = {},
): Response {
    if (!facts) return errorResponse('No product facts yet.', 404, { code: 'NOT_FOUND' });
    const url = new URL(from);
    url.search = '';
    url.hash = '';
    const owner = opts.scope === 'owner';
    const doc = ottaJson(facts, { from: url.href, scope: owner ? 'owner' : 'public' });
    const etag = `"${doc.hash}${owner ? '-owner' : ''}"`;
    // No referrer: a founder who opens the keyed address in a tab and follows a link out of it must not hand the key
    // to the next site. nosniff: the file is JSON and nothing a browser should guess at.
    const headers = {
        etag,
        'access-control-allow-origin': '*',
        'cache-control': owner ? 'private, no-store' : 'public, max-age=300',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
    };
    if (opts.ifNoneMatch && opts.ifNoneMatch.split(',').some((t) => t.trim() === etag))
        return new Response(null, { status: 304, headers });
    return jsonResponse(doc, 200, { headers });
}
