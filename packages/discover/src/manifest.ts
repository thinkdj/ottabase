// ============================================================
// @ottabase/discover: the manifest, for Worker-served apps
// ============================================================
// One entry in `ottabase/packages.ts` and the Worker answers `/robots.txt`, `/.well-known/otta.json`
// and, when given entries, `/sitemap.xml`, all from one ProductFacts. Mounted at `/`, which
// the kernel allows; the three paths are static, so they never shadow the host's own routes.
// A Next.js app uses `@ottabase/discover/next` instead and never loads this file.
// ============================================================

import { definePackage, type OttaPackage } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import type { ProductFacts } from './facts';
import { OTTA_JSON_PATH } from './otta-json';
import { ottaJsonResponse, robotsResponse, sitemapResponse } from './responses';
import type { RobotsOptions } from './robots';
import type { SitemapEntry } from './sitemap';

export const DISCOVER_PACKAGE_KEY = 'discover';

type Awaitable<T> = T | Promise<T>;
/** A value, or a function of the request env that gives one (facts that live in D1, a sitemap read per request). */
type Given<Env, T> = T | ((env: Env) => Awaitable<T>);

export interface DiscoverOptions<Env = unknown> {
    /** The product's facts, or null while there are none yet (otta.json then answers 404). */
    facts: Given<Env, ProductFacts | null>;
    /** robots.txt options: the sitemap address, private paths, the training switch, `closed` off production. */
    robots?: Given<Env, RobotsOptions>;
    /** Entries for `/sitemap.xml`. Without it the route is not mounted. */
    sitemap?: (env: Env) => Awaitable<SitemapEntry[]>;
}

const resolve = async <Env, T>(given: Given<Env, T>, env: Env): Promise<T> =>
    typeof given === 'function' ? await (given as (env: Env) => Awaitable<T>)(env) : given;

export function createDiscoverPackage<Env = unknown>(options: DiscoverOptions<Env>): OttaPackage<Env> {
    return definePackage<Env>({
        key: DISCOVER_PACKAGE_KEY,
        name: 'Discover',
        version: '1.0.0',
        description:
            'robots.txt naming the AI search crawlers, /.well-known/otta.json with the product facts, and a sitemap.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/discover#readme',
        routes: {
            basePath: '/',
            build: () => {
                const router = new Router<Env>();
                router.get('/robots.txt', async (c) => robotsResponse(await resolve(options.robots ?? {}, c.env)));
                router.get(OTTA_JSON_PATH, async (c) =>
                    ottaJsonResponse(await resolve(options.facts, c.env), c.req.url),
                );
                if (options.sitemap) {
                    const sitemap = options.sitemap;
                    router.get('/sitemap.xml', async (c) => sitemapResponse(await sitemap(c.env)));
                }
                return router;
            },
        },
        health: async (env) => {
            const facts = await resolve(options.facts, env);
            return {
                name: 'discover:facts',
                ok: Boolean(facts),
                detail: facts
                    ? `${OTTA_JSON_PATH} describes ${facts.name}`
                    : `no product facts yet: ${OTTA_JSON_PATH} answers 404`,
            };
        },
    });
}
