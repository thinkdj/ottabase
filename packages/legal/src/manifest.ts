/**
 * The kernel package: stateless, no tables. Routes serve every published document from the Worker, so the pages exist
 * for crawlers, for apps without a SPA, and for a footer that wants the list.
 *
 *   GET {basePath}                 the index (HTML page, or JSON list when `serve` is 'api')
 *   GET {basePath}/{slug}          the document (HTML page, or JSON when `serve` is 'api')
 *   GET {basePath}/{slug}.html     always the HTML page
 *   GET {basePath}/{slug}.md       always Markdown
 *   GET {basePath}/{slug}.json     always JSON: id, slug, title, lastUpdated, markdown, toc, copyright
 *   GET {basePath}/index.json      always the JSON list of published documents
 *
 * A disabled or unknown document falls through (null), so a SPA or a 404 handler takes over. The health probe reports
 * the config gaps from `validateLegalConfig`, so a placeholder jurisdiction shows up in the Fleet report, not in court.
 */

import { definePackage, type HealthCheck, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { jsonResponse } from '@ottabase/utils/http-response';
import { assembleLegalDocument, listLegalDocuments, resolveLegalSlug } from './assemble';
import { validateLegalConfig } from './config';
import { documentToMarkdown, pageToHtml } from './html';
import { legalBaseOf } from './interpolate';
import type { AssembledLegalDocument, LegalConfig, LegalDocId } from './types';

export const LEGAL_PACKAGE_KEY = 'legal';

export interface LegalPackageOptions<Env> extends PackageExtras<Env> {
    /** The config, static or derived from env for multi-domain deployments. */
    config: LegalConfig | ((env: Env) => LegalConfig);
    /**
     * Where the routes mount. Default: the config's `basePath`, itself defaulting to `/legal`. Mount an app that renders
     * the pages in its SPA at another path (such as `/api/legal`) with `serve: 'api'`, and keep `config.basePath` as the
     * path the SPA serves, so cross-document links point at the pages.
     */
    basePath?: string;
    /** What a bare document URL returns: a rendered HTML page (default) or JSON for a client renderer. */
    serve?: 'html' | 'api';
    /** `Cache-Control` max-age in seconds for every response. Default one hour. */
    maxAge?: number;
}

/** Assembled documents per config object, so a static config renders each document once per isolate. */
const cache = new WeakMap<LegalConfig, Map<LegalDocId, AssembledLegalDocument>>();
function assembled(config: LegalConfig, id: LegalDocId): AssembledLegalDocument {
    let docs = cache.get(config);
    if (!docs) cache.set(config, (docs = new Map()));
    let doc = docs.get(id);
    if (!doc) docs.set(id, (doc = assembleLegalDocument(id, config)));
    return doc;
}

const json = (body: unknown, headers: Record<string, string>) => jsonResponse(body, 200, { headers });
const text = (body: string, type: string, headers: Record<string, string>) =>
    new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, ...headers } });

export function createLegalPackage<Env = unknown>(options: LegalPackageOptions<Env>): OttaPackage<Env> {
    const { config, basePath, serve = 'html', maxAge = 3600, ...extras } = options;
    const resolve = typeof config === 'function' ? (config as (env: Env) => LegalConfig) : () => config;
    const mount = (basePath ?? (typeof config === 'function' ? '/legal' : legalBaseOf(config))) || '/';
    const headers = { 'cache-control': `public, max-age=${maxAge}` };

    return definePackage<Env>({
        key: LEGAL_PACKAGE_KEY,
        name: 'Legal pages',
        version: '2.0.0',
        description: 'Terms, privacy, cookies, acceptable use, refunds and sub-processors from one config.',
        routes: {
            basePath: mount,
            build: () => {
                const router = new Router<Env>();
                const index = (cfg: LegalConfig, as: 'html' | 'json') =>
                    as === 'json'
                        ? json(listLegalDocuments(cfg), headers)
                        : text(pageToHtml(cfg), 'text/html', headers);
                router.get('/', (c) => index(resolve(c.env), serve === 'api' ? 'json' : 'html'));
                router.get('/index.json', (c) => index(resolve(c.env), 'json'));
                router.get('/:slug', (c) => {
                    const cfg = resolve(c.env);
                    const m = /^([a-z-]+?)(?:\.(html|md|json))?$/.exec(c.params.slug ?? '');
                    const id = m ? resolveLegalSlug(m[1], cfg) : null;
                    if (!id) return null;
                    const as = m![2] ?? (serve === 'api' ? 'json' : 'html');
                    const doc = assembled(cfg, id);
                    if (as === 'md') return text(documentToMarkdown(doc), 'text/markdown', headers);
                    if (as === 'json') return json(doc, headers);
                    return text(pageToHtml(cfg, doc), 'text/html', headers);
                });
                return router;
            },
        },
        health: (env: Env): HealthCheck => {
            try {
                const gaps = validateLegalConfig(resolve(env));
                return { name: 'legal:config', ok: gaps.length === 0, detail: gaps.join(' ') || undefined };
            } catch (e) {
                return { name: 'legal:config', ok: false, detail: e instanceof Error ? e.message : String(e) };
            }
        },
        ...extras,
    });
}
