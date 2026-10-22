// ============================================================
// /.well-known/otta.json: the product's facts in the otta-context shape
// ============================================================
// The same document Ottabuzz serves for a project as `context.json` (its `src/context.ts`):
// version 1, kind "otta-context", a `product` with the brief's sections as fields and the
// press kit's addresses. Served from the product's own site, it lets a tool read the facts
// the maker wrote instead of guessing them from the page. Ottabuzz reads it when it is
// there and reads the page when it is not. Nothing private goes in: `neverClaim` is always
// empty here, since this file sits on the open web.
// ============================================================

import { firstParagraph, pricingLine, type Hero, type ProductFacts } from './facts';

export const OTTA_CONTEXT_VERSION = 1;
export const OTTA_CONTEXT_KIND = 'otta-context';
export const OTTA_JSON_PATH = '/.well-known/otta.json';

export interface OttaContextProduct {
    name: string;
    url: string;
    tagline: string;
    stage: string;
    launchOn: string | null;
    whatItIs: string;
    whoItIsFor: string;
    problem: string;
    features: string[];
    pricing: string;
    different: string;
    objections: string[];
    neverClaim: string[];
    positioning: string;
    keywords: string[];
    hero: Hero | null;
    brief: string;
    bio: string;
    contact: string;
    log: string | null;
    feed: string | null;
    press: string | null;
    card: string | null;
    logo: string | null;
    screenshots: string[];
}

export interface OttaContext {
    version: typeof OTTA_CONTEXT_VERSION;
    kind: typeof OTTA_CONTEXT_KIND;
    /** When it was written, ISO. */
    at: string;
    /** This file's own address. */
    from: string;
    product: OttaContextProduct;
}

/** The public file. `from` is the address it is served at; `at` defaults to now. */
export function ottaJson(facts: ProductFacts, opts: { from: string; at?: Date }): OttaContext {
    return {
        version: OTTA_CONTEXT_VERSION,
        kind: OTTA_CONTEXT_KIND,
        at: (opts.at ?? new Date()).toISOString(),
        from: opts.from,
        product: {
            name: facts.name,
            url: facts.url,
            tagline: facts.tagline ?? firstParagraph(facts.whatItIs).slice(0, 200),
            stage: facts.stage ?? '',
            launchOn: facts.launched ?? null,
            whatItIs: facts.whatItIs ?? '',
            whoItIsFor: facts.whoItIsFor ?? '',
            problem: '',
            features: facts.features,
            pricing: pricingLine(facts.pricing),
            different: facts.different ?? '',
            objections: [],
            neverClaim: [],
            positioning: '',
            keywords: facts.keywords ?? [],
            hero: facts.hero ?? null,
            brief: '',
            bio: facts.founder?.bio ?? '',
            contact: facts.contact ?? '',
            log: null,
            feed: null,
            press: null,
            card: facts.image ?? null,
            logo: facts.logo ?? null,
            screenshots: facts.screenshots ?? [],
        },
    };
}

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v: unknown): string[] =>
    Array.isArray(v)
        ? v
              .map((x) => str(x, 400))
              .filter(Boolean)
              .slice(0, 40)
        : [];
const urlOrNull = (v: unknown): string | null => (/^https?:\/\//i.test(str(v, 500)) ? str(v, 500) : null);

/**
 * Read a context file from any source (this package, Ottabuzz, a hand-written one). Lenient:
 * a field that is missing or the wrong shape becomes empty, so a consumer never throws on an
 * older or odd file. Null only when it is not a context file at all, or names no product.
 */
export function parseOttaJson(raw: unknown): OttaContext | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const p = r.product && typeof r.product === 'object' ? (r.product as Record<string, unknown>) : null;
    if (r.kind !== OTTA_CONTEXT_KIND || !p || !str(p.name, 80)) return null;
    const hero = p.hero && typeof p.hero === 'object' ? (p.hero as Record<string, unknown>) : null;
    return {
        version: OTTA_CONTEXT_VERSION,
        kind: OTTA_CONTEXT_KIND,
        at: str(r.at, 40),
        from: str(r.from, 500),
        product: {
            name: str(p.name, 80),
            url: urlOrNull(p.url) ?? '',
            tagline: str(p.tagline, 300),
            stage: str(p.stage, 20),
            launchOn: /^\d{4}-\d{2}-\d{2}$/.test(str(p.launchOn, 10)) ? str(p.launchOn, 10) : null,
            whatItIs: str(p.whatItIs),
            whoItIsFor: str(p.whoItIsFor, 600),
            problem: str(p.problem),
            features: strs(p.features),
            pricing: str(p.pricing, 600),
            different: str(p.different),
            objections: strs(p.objections),
            neverClaim: strs(p.neverClaim),
            positioning: str(p.positioning),
            keywords: strs(p.keywords),
            hero:
                hero && str(hero.line, 300)
                    ? { line: str(hero.line, 300), sub: str(hero.sub, 300), button: str(hero.button, 40) }
                    : null,
            brief: str(p.brief, 20000),
            bio: str(p.bio),
            contact: str(p.contact, 300),
            log: urlOrNull(p.log),
            feed: urlOrNull(p.feed),
            press: urlOrNull(p.press),
            card: urlOrNull(p.card),
            logo: urlOrNull(p.logo),
            screenshots: strs(p.screenshots).filter((u) => /^https?:\/\//i.test(u)),
        },
    };
}
