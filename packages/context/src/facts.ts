// ============================================================
// defineProduct: facts from any source, clamped, never invented
// ============================================================
// A config file, a database row, a form, Ottabuzz's brief: whatever the author has becomes
// one `ProductFacts`. Every field is clamped to a sane length, anything of the wrong shape is
// dropped, addresses have to be absolute, colours have to be #rrggbb. It throws only without
// a name or an absolute URL, since nothing downstream can be built without those two. It
// never fills a blank: a missing fact stays missing, because a blank is honest and a guess is
// not.
// ============================================================

import type {
    Brand,
    Copy,
    Facts,
    Feeds,
    Founder,
    Hero,
    Links,
    Plan,
    PlanPeriod,
    Pricing,
    ProductFacts,
    Screenshot,
    Stage,
} from './types';

export const MAX = {
    name: 80,
    tagline: 200,
    paragraph: 2000,
    long: 4000,
    line: 300,
    feature: 160,
    list: 24,
    url: 500,
    keyword: 60,
    brief: 20000,
} as const;

export const str = (v: unknown, max: number): string =>
    typeof v === 'string'
        ? v
              .trim()
              .replace(/[ \t]+/g, ' ')
              .slice(0, max)
        : '';
/** A paragraph keeps its line breaks; only the ends are trimmed. */
export const para = (v: unknown, max: number): string =>
    typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '';
export const list = (v: unknown, max: number, each: number): string[] =>
    Array.isArray(v)
        ? v
              .map((x) => str(x, each))
              .filter(Boolean)
              .slice(0, max)
        : [];
export const obj = (v: unknown): Record<string, unknown> | null =>
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
export const urlOrNull = (v: unknown): string | null => httpUrl(v) || null;

/** A colour as #rrggbb, lower case; #rgb is widened; anything else is ''. */
export function hexColor(v: unknown): string {
    const s = str(v, 7).toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
    return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : '';
}

const isoDate = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) ? str(v, 10) : '');
const STAGES: Stage[] = ['idea', 'building', 'launched', 'users'];
const PERIODS: PlanPeriod[] = ['month', 'year', 'once'];

export function plan(raw: unknown): Plan | null {
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

/** Only the keys that have a value, so a clamped block is as sparse as what came in. */
const sparse = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => (Array.isArray(v) ? v.length : v !== '' && v != null))) as T;
const has = (o: object) => Object.keys(o).length > 0;

/** Network keys are short lower-case words; values are absolute addresses. */
export function socials(raw: unknown): Record<string, string> {
    const r = obj(raw);
    const out: Record<string, string> = {};
    if (!r) return out;
    // Twenty networks is more than any founder has; a file with a thousand keys is not a founder's.
    for (const [k, v] of Object.entries(r).slice(0, 20)) {
        const key = str(k, 20).toLowerCase();
        const url = httpUrl(v);
        if (/^[a-z][a-z0-9]{0,19}$/.test(key) && url) out[key] = url;
    }
    return out;
}

export function founder(raw: unknown): Founder | undefined {
    const r = obj(raw);
    const name = r && str(r.name, MAX.name);
    if (!r || !name) return undefined;
    const f: Founder = sparse({
        name,
        title: str(r.title, MAX.name),
        url: httpUrl(r.url),
        bio: para(r.bio, MAX.paragraph),
        bioShort: str(r.bioShort, MAX.line),
        photo: httpUrl(r.photo),
        place: str(r.place, MAX.name),
    });
    const s = socials(r.socials);
    if (has(s)) f.socials = s;
    return f;
}

export function brand(raw: unknown): Brand | undefined {
    const r = obj(raw);
    if (!r) return undefined;
    const b: Brand = sparse({
        primary: hexColor(r.primary),
        secondary: hexColor(r.secondary),
        background: hexColor(r.background),
        foreground: hexColor(r.foreground),
        fontHeading: str(r.fontHeading, MAX.name),
        fontBody: str(r.fontBody, MAX.name),
        logo: httpUrl(r.logo),
        logoDark: httpUrl(r.logoDark),
        wordmark: httpUrl(r.wordmark),
        icon: httpUrl(r.icon),
        naming: str(r.naming, MAX.line),
        pronounce: str(r.pronounce, MAX.name),
    });
    return has(b) ? b : undefined;
}

export function facts(raw: unknown): Facts | undefined {
    const r = obj(raw);
    if (!r) return undefined;
    const f: Facts = sparse({
        founded: str(r.founded, 40),
        location: str(r.location, MAX.name),
        team: str(r.team, MAX.name),
        category: str(r.category, MAX.name),
        platforms: list(r.platforms, 16, 30),
        license: str(r.license, 60),
        stack: str(r.stack, MAX.tagline),
    });
    return has(f) ? f : undefined;
}

const urls = <K extends string>(raw: unknown, keys: readonly K[]): Record<K, string> | undefined => {
    const r = obj(raw);
    if (!r) return undefined;
    const out = {} as Record<K, string>;
    for (const k of keys) {
        const u = httpUrl(r[k]);
        if (u) out[k] = u;
    }
    return has(out) ? out : undefined;
};
export const FEED_KEYS = ['blog', 'releases', 'changelog', 'log'] as const satisfies readonly (keyof Feeds)[];
export const LINK_KEYS = [
    'docs',
    'repo',
    'pricing',
    'changelog',
    'status',
    'press',
    'pressMarkdown',
    'pressZip',
    'context',
    'brand',
    'card',
] as const satisfies readonly (keyof Links)[];

export function copy(raw: unknown): Copy | undefined {
    const r = obj(raw);
    if (!r) return undefined;
    const c: Copy = sparse({
        short: str(r.short, MAX.line * 2),
        medium: para(r.medium, MAX.paragraph),
        long: para(r.long, MAX.long),
        boilerplate: para(r.boilerplate, MAX.paragraph),
        taglines: list(r.taglines, 12, 120),
        quotes: list(r.quotes, 6, 400),
        angles: list(r.angles, 6, MAX.line),
        story: para(r.story, MAX.long),
        notA: list(r.notA, 8, MAX.tagline),
        milestones: list(r.milestones, 24, MAX.tagline),
        coverage: list(r.coverage, 24, MAX.line),
        metaTitle: str(r.metaTitle, 120),
        metaDescription: str(r.metaDescription, MAX.line),
    });
    return has(c) ? c : undefined;
}

export function screenshots(raw: unknown): Screenshot[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((x): Screenshot | null => {
            const r = obj(x);
            const url = httpUrl(r ? r.url : x);
            if (!url) return null;
            const caption = r ? str(r.caption, MAX.feature) : '';
            return caption ? { url, caption } : { url };
        })
        .filter((s): s is Screenshot => s !== null)
        .slice(0, 12);
}

/**
 * Clamp and normalise facts from any source. Throws only when there is no name or no absolute
 * URL. Everything else is optional and missing stays missing.
 */
export function defineProduct(raw: ProductFacts | Record<string, unknown>): ProductFacts {
    const r = raw as Record<string, unknown>;
    const name = str(r.name, MAX.name);
    const url = httpUrl(r.url);
    if (!name) throw new Error('[otta-context] defineProduct: a product needs a name.');
    if (!url) throw new Error(`[otta-context] defineProduct: "${name}" needs an absolute http(s) url.`);

    const out: ProductFacts = { name, url, features: list(r.features, MAX.list, MAX.feature) };
    const pricingRaw = obj(r.pricing);
    const plans = pricingRaw
        ? (Array.isArray(pricingRaw.plans) ? pricingRaw.plans : [])
              .map(plan)
              .filter((p): p is Plan => p !== null)
              .slice(0, 6)
        : [];
    const note = pricingRaw ? str(pricingRaw.note, MAX.line) : '';
    if (plans.length || note) out.pricing = { plans, ...(note ? { note } : {}) } as Pricing;

    const set = <K extends keyof ProductFacts>(k: K, v: ProductFacts[K] | '' | undefined | null) => {
        if (v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && !v.length)) out[k] = v;
    };
    set('tagline', str(r.tagline, MAX.tagline));
    set('whatItIs', para(r.whatItIs, MAX.paragraph));
    set('whoItIsFor', str(r.whoItIsFor, MAX.line * 2));
    set('pricingText', str(r.pricingText, MAX.line * 2));
    set('problem', para(r.problem, MAX.paragraph));
    set('different', para(r.different, MAX.paragraph));
    set('positioning', para(r.positioning, MAX.paragraph));
    set('objections', list(r.objections, 12, MAX.line));
    set('neverClaim', list(r.neverClaim, MAX.list, MAX.feature));
    set('founder', founder(r.founder));
    set('brand', brand(r.brand));
    set('facts', facts(r.facts));
    set('feeds', urls(r.feeds, FEED_KEYS));
    set('links', urls(r.links, LINK_KEYS));
    set('copy', copy(r.copy));
    set('logo', httpUrl(r.logo));
    set('image', httpUrl(r.image));
    set('screenshots', screenshots(r.screenshots));
    set('sameAs', [...new Set(list(r.sameAs, 12, MAX.url).map(httpUrl).filter(Boolean))]);
    set('contact', str(r.contact, MAX.line));
    set('launched', isoDate(r.launched));
    set('keywords', list(r.keywords, MAX.list, MAX.keyword));
    set('docsUrl', httpUrl(r.docsUrl));
    if (STAGES.includes(r.stage as Stage)) out.stage = r.stage as Stage;
    const heroRaw = obj(r.hero);
    if (heroRaw && str(heroRaw.line, MAX.line)) {
        const hero: Hero = { line: str(heroRaw.line, MAX.line) };
        if (str(heroRaw.sub, MAX.line)) hero.sub = str(heroRaw.sub, MAX.line);
        if (str(heroRaw.button, 40)) hero.button = str(heroRaw.button, 40);
        out.hero = hero;
    }
    set('brief', para(r.brief, MAX.brief));
    const updated = str(r.updatedAt, 40);
    if (updated && !Number.isNaN(Date.parse(updated))) out.updatedAt = new Date(updated).toISOString();
    return out;
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
