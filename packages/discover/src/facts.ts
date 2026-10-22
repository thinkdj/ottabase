// ============================================================
// ProductFacts: the one object everything else is generated from
// ============================================================
// What a product says about itself, in plain fields, so robots.txt, the sitemap, otta.json,
// JSON-LD and the canonical paragraph never disagree. `defineProduct` clamps and drops; it
// never invents a value, because a blank field is honest and a guessed one is not.
// ============================================================

export type PlanPeriod = 'month' | 'year' | 'once';

export interface Plan {
    name: string;
    /** A number in `currency`, or 'free'. */
    price: number | 'free';
    /** ISO 4217, e.g. "USD". Defaults to USD when a price is given without one. */
    currency: string;
    period: PlanPeriod;
    includes: string[];
}

export interface Pricing {
    plans: Plan[];
    /** One line the plans cannot say ("Open source; hosting is yours."). */
    note?: string;
}

export interface Founder {
    name: string;
    url?: string;
    bio?: string;
}

export interface Hero {
    line: string;
    sub?: string;
    button?: string;
}

export type Stage = 'idea' | 'building' | 'launched' | 'users';

export interface ProductFacts {
    name: string;
    /** The product's own site, absolute. */
    url: string;
    tagline?: string;
    /** One or two paragraphs, blank line between them. */
    whatItIs?: string;
    whoItIsFor?: string;
    features: string[];
    pricing?: Pricing;
    /** What makes it different, one paragraph. */
    different?: string;
    /**
     * What copy about the product must never claim. Never published: it is for consumers that
     * generate words (Ottabuzz's drafts, Imageine's decks), read from a private copy, not from
     * a file on the web.
     */
    neverClaim?: string[];
    founder?: Founder;
    /** Absolute URLs. */
    logo?: string;
    /** The 1200 by 630 social image, absolute. */
    image?: string;
    screenshots?: string[];
    /** Profiles that are the same entity: GitHub, X, LinkedIn, Product Hunt, Crunchbase. */
    sameAs?: string[];
    /** An email or a URL. */
    contact?: string;
    /** ISO date, "2026-03-01". */
    launched?: string;
    keywords?: string[];
    docsUrl?: string;
    stage?: Stage;
    /** The landing page's first screen, when the product has one: a line, a line under it, a button. */
    hero?: Hero;
}

const MAX = {
    name: 80,
    tagline: 200,
    paragraph: 2000,
    line: 300,
    feature: 160,
    list: 24,
    url: 500,
    keyword: 60,
} as const;

const str = (v: unknown, max: number): string =>
    typeof v === 'string'
        ? v
              .trim()
              .replace(/[ \t]+/g, ' ')
              .slice(0, max)
        : '';
const list = (v: unknown, max: number, each: number): string[] =>
    Array.isArray(v)
        ? v
              .map((x) => str(x, each))
              .filter(Boolean)
              .slice(0, max)
        : [];
const obj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** An absolute http(s) URL, normalised, or '' for anything else. */
export function httpUrl(v: unknown): string {
    const s = str(v, MAX.url);
    if (!/^https?:\/\//i.test(s)) return '';
    try {
        return new URL(s).href;
    } catch {
        return '';
    }
}

const STAGES: Stage[] = ['idea', 'building', 'launched', 'users'];
const PERIODS: PlanPeriod[] = ['month', 'year', 'once'];

function plan(raw: unknown): Plan | null {
    const r = obj(raw);
    const name = r && str(r.name, MAX.name);
    if (!r || !name) return null;
    const price =
        r.price === 'free' || r.price === 0
            ? 'free'
            : typeof r.price === 'number' && Number.isFinite(r.price) && r.price > 0
              ? Math.round(r.price * 100) / 100
              : null;
    if (price === null) return null;
    return {
        name,
        price,
        currency: /^[A-Z]{3}$/.test(str(r.currency, 3)) ? str(r.currency, 3) : 'USD',
        period: PERIODS.includes(r.period as PlanPeriod) ? (r.period as PlanPeriod) : 'month',
        includes: list(r.includes, 12, MAX.feature),
    };
}

/**
 * Clamp and normalise facts from any source: a config file, a database row, a form. Throws
 * only when there is no name or no absolute URL, since nothing downstream can be built
 * without those two. Everything else is optional and missing stays missing.
 */
export function defineProduct(raw: ProductFacts | Record<string, unknown>): ProductFacts {
    const r = raw as Record<string, unknown>;
    const name = str(r.name, MAX.name);
    const url = httpUrl(r.url);
    if (!name) throw new Error('[discover] defineProduct: a product needs a name.');
    if (!url) throw new Error(`[discover] defineProduct: "${name}" needs an absolute http(s) url.`);

    const pricingRaw = obj(r.pricing);
    const plans = pricingRaw ? (Array.isArray(pricingRaw.plans) ? pricingRaw.plans : []).map(plan) : [];
    const founderRaw = obj(r.founder);
    const heroRaw = obj(r.hero);
    const facts: ProductFacts = { name, url, features: list(r.features, MAX.list, MAX.feature) };

    const tagline = str(r.tagline, MAX.tagline);
    const whatItIs = typeof r.whatItIs === 'string' ? r.whatItIs.trim().slice(0, MAX.paragraph) : '';
    const whoItIsFor = str(r.whoItIsFor, MAX.line);
    const different = str(r.different, MAX.paragraph);
    const neverClaim = list(r.neverClaim, MAX.list, MAX.feature);
    const logo = httpUrl(r.logo);
    const image = httpUrl(r.image);
    const screenshots = list(r.screenshots, 12, MAX.url).map(httpUrl).filter(Boolean);
    const sameAs = list(r.sameAs, 12, MAX.url).map(httpUrl).filter(Boolean);
    const contact = str(r.contact, MAX.line);
    const launched = /^\d{4}-\d{2}-\d{2}$/.test(str(r.launched, 10)) ? str(r.launched, 10) : '';
    const keywords = list(r.keywords, MAX.list, MAX.keyword);
    const docsUrl = httpUrl(r.docsUrl);
    const note = pricingRaw ? str(pricingRaw.note, MAX.line) : '';
    const kept = plans.filter((p): p is Plan => p !== null).slice(0, 6);

    if (tagline) facts.tagline = tagline;
    if (whatItIs) facts.whatItIs = whatItIs;
    if (whoItIsFor) facts.whoItIsFor = whoItIsFor;
    if (kept.length || note) facts.pricing = { plans: kept, ...(note ? { note } : {}) };
    if (different) facts.different = different;
    if (neverClaim.length) facts.neverClaim = neverClaim;
    if (founderRaw && str(founderRaw.name, MAX.name)) {
        facts.founder = { name: str(founderRaw.name, MAX.name) };
        if (httpUrl(founderRaw.url)) facts.founder.url = httpUrl(founderRaw.url);
        if (str(founderRaw.bio, MAX.paragraph)) facts.founder.bio = str(founderRaw.bio, MAX.paragraph);
    }
    if (logo) facts.logo = logo;
    if (image) facts.image = image;
    if (screenshots.length) facts.screenshots = screenshots;
    if (sameAs.length) facts.sameAs = sameAs;
    if (contact) facts.contact = contact;
    if (launched) facts.launched = launched;
    if (keywords.length) facts.keywords = keywords;
    if (docsUrl) facts.docsUrl = docsUrl;
    if (STAGES.includes(r.stage as Stage)) facts.stage = r.stage as Stage;
    if (heroRaw && str(heroRaw.line, MAX.line)) {
        facts.hero = { line: str(heroRaw.line, MAX.line) };
        if (str(heroRaw.sub, MAX.line)) facts.hero.sub = str(heroRaw.sub, MAX.line);
        if (str(heroRaw.button, 40)) facts.hero.button = str(heroRaw.button, 40);
    }
    return facts;
}

const PERIOD_WORDS: Record<PlanPeriod, string> = { month: 'a month', year: 'a year', once: 'once' };

/** A plan's price as words: "free", "$15 a month", "EUR 49 once". */
export function priceWords(p: Plan): string {
    if (p.price === 'free') return 'free';
    const amount = p.currency === 'USD' ? `$${p.price}` : `${p.currency} ${p.price}`;
    return `${amount} ${PERIOD_WORDS[p.period]}`;
}

/** Pricing as one plain line, the way a page should say it: "Hobby free; Pro $15 a month; Team $49 a month." */
export function pricingLine(pricing?: Pricing): string {
    if (!pricing) return '';
    const plans = pricing.plans.map((p) => `${p.name} ${priceWords(p)}`).join('; ');
    return [plans && `${plans}.`, pricing.note].filter(Boolean).join(' ');
}

/** The first paragraph of a multi-paragraph field, on one line. */
export const firstParagraph = (text = ''): string =>
    text
        .split(/\n\s*\n/)[0]
        ?.replace(/\s+/g, ' ')
        .trim() ?? '';

/** The first sentence of a text, or the text itself when it has no full stop. */
export const firstSentence = (text = ''): string =>
    (/^(.+?[.!?])(?:\s|$)/.exec(text.replace(/\s+/g, ' ').trim())?.[1] ?? text.replace(/\s+/g, ' ').trim()).trim();
