// ============================================================
// The wire document: write it, hash it, read it back
// ============================================================
// `ottaJson` turns facts into the document a site serves. `parseOttaJson` reads one from any
// source, version 1 or 2, this package's or Ottabuzz's or a hand-written one, leniently: a
// field that is missing or the wrong shape becomes empty, so a consumer never throws on an
// older or odd file. `contextHash` is the change signal: the same product facts give the same
// hash whoever wrote the file and whenever, so a reader that kept the last hash knows in one
// comparison whether anything moved.
// ============================================================

import {
    FEED_KEYS,
    firstParagraph,
    hexColor,
    httpUrl,
    LINK_KEYS,
    list,
    obj,
    para,
    plan,
    pricingLine,
    socials,
    str,
    urlOrNull,
} from './facts';
import {
    OTTA_CONTEXT_KIND,
    OTTA_CONTEXT_VERSION,
    type Hero,
    type OttaContext,
    type OttaContextProduct,
    type Plan,
    type ProductFacts,
    type Scope,
    type WireBrand,
    type WireCopy,
    type WireFacts,
    type WireFeeds,
    type WireFounder,
    type WireLinks,
} from './types';

/** cyrb53: a small, fast, well-mixed 53-bit hash, as 14 hex characters. Not cryptographic; a change signal. */
export function hashText(s: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0').slice(2);
}

/** JSON with keys in a fixed order at every depth, so the same facts always give the same text. */
export const canonical = (v: unknown): string =>
    Array.isArray(v)
        ? `[${v.map(canonical).join(',')}]`
        : v && typeof v === 'object'
          ? `{${Object.keys(v as object)
                .sort()
                .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
                .join(',')}}`
          : JSON.stringify(v ?? null);

/** The hash of a product block. */
export const contextHash = (product: OttaContextProduct): string => hashText(canonical(product));

export const emptyBrand = (): WireBrand => ({
    primary: '',
    secondary: '',
    background: '',
    foreground: '',
    fontHeading: '',
    fontBody: '',
    logo: null,
    logoDark: null,
    wordmark: null,
    icon: null,
    naming: '',
    pronounce: '',
});
export const emptyFounder = (): WireFounder => ({
    name: '',
    title: '',
    url: null,
    bio: '',
    bioShort: '',
    photo: null,
    place: '',
    socials: {},
});
export const emptyFacts = (): WireFacts => ({
    founded: '',
    location: '',
    team: '',
    category: '',
    platforms: [],
    license: '',
    stack: '',
});
export const emptyFeeds = (): WireFeeds => ({ blog: null, releases: null, changelog: null, log: null });
export const emptyLinks = (): WireLinks => Object.fromEntries(LINK_KEYS.map((k) => [k, null])) as unknown as WireLinks;
export const emptyCopy = (): WireCopy => ({
    short: '',
    medium: '',
    long: '',
    boilerplate: '',
    taglines: [],
    quotes: [],
    angles: [],
    story: '',
    notA: [],
    milestones: [],
    coverage: [],
    metaTitle: '',
    metaDescription: '',
});

/** The product block from facts. `scope` 'owner' keeps the writer-only fields; 'public' blanks them. */
export function productOf(f: ProductFacts, scope: Scope = 'public'): OttaContextProduct {
    const owner = scope === 'owner';
    const shots = (f.screenshots ?? []).map((s) => (typeof s === 'string' ? { url: s } : s));
    const b = f.brand ?? {};
    const fo = f.founder;
    const fa = f.facts ?? {};
    const c = f.copy ?? {};
    const links: WireLinks = { ...emptyLinks(), ...(f.links ?? {}) };
    const feeds: WireFeeds = { ...emptyFeeds(), ...(f.feeds ?? {}) };
    if (f.docsUrl && !links.docs) links.docs = f.docsUrl;
    if (f.image && !links.card) links.card = f.image;
    return {
        name: f.name,
        url: f.url,
        tagline: f.tagline ?? firstParagraph(f.whatItIs).slice(0, 200),
        stage: f.stage ?? '',
        launchOn: f.launched ?? null,
        whatItIs: f.whatItIs ?? '',
        whoItIsFor: f.whoItIsFor ?? '',
        problem: f.problem ?? '',
        features: f.features,
        pricing: pricingLine(f.pricing) || f.pricingText || '',
        different: f.different ?? '',
        objections: f.objections ?? [],
        neverClaim: owner ? (f.neverClaim ?? []) : [],
        positioning: f.positioning ?? '',
        keywords: f.keywords ?? [],
        hero: f.hero ?? null,
        brief: owner ? (f.brief ?? '') : '',
        bio: fo?.bio ?? '',
        contact: f.contact ?? '',
        log: feeds.log ? feeds.log.replace(/\/feed\/?$/, '') : null,
        feed: feeds.log ?? feeds.blog,
        press: links.press,
        card: links.card,
        logo: b.logo ?? f.logo ?? null,
        screenshots: shots.map((s) => s.url),
        plans: f.pricing?.plans ?? [],
        pricingNote: f.pricing?.note ?? '',
        captions: Object.fromEntries(shots.filter((s) => s.caption).map((s) => [s.url, s.caption!])),
        sameAs: [...new Set([...(f.sameAs ?? []), ...Object.values(fo?.socials ?? {})])],
        docs: links.docs,
        image: f.image ?? links.card,
        brand: { ...emptyBrand(), ...b, logo: b.logo ?? f.logo ?? null },
        founder: fo ? { ...emptyFounder(), ...fo, url: fo.url ?? null, photo: fo.photo ?? null } : emptyFounder(),
        facts: { ...emptyFacts(), ...fa },
        feeds,
        links,
        copy: { ...emptyCopy(), ...c },
    };
}

/** The document. `from` is the address it is served at. `at` is the facts' own updatedAt when they have one, else
 *  the time given, else now. */
export function ottaJson(f: ProductFacts, opts: { from: string; at?: Date; scope?: Scope }): OttaContext {
    const product = productOf(f, opts.scope);
    return {
        version: OTTA_CONTEXT_VERSION,
        kind: OTTA_CONTEXT_KIND,
        at: f.updatedAt ?? (opts.at ?? new Date()).toISOString(),
        from: opts.from,
        scope: opts.scope ?? 'public',
        hash: contextHash(product),
        product,
    };
}

const strs = (v: unknown, max = 40, each = 400): string[] => list(v, max, each);
const plans = (v: unknown): Plan[] =>
    Array.isArray(v)
        ? v
              .map(plan)
              .filter((p): p is Plan => p !== null)
              .slice(0, 6)
        : [];
const captions = (v: unknown): Record<string, string> => {
    const r = obj(v);
    const out: Record<string, string> = {};
    if (r) for (const [k, c] of Object.entries(r)) if (httpUrl(k) && str(c, 160)) out[httpUrl(k)] = str(c, 160);
    return out;
};

/**
 * Read a context document from any source. Null only when it is not one at all, or names no product. A version 1
 * file comes back with the version 2 blocks empty; the hash is computed when the file carries none.
 */
export function parseOttaJson(raw: unknown): OttaContext | null {
    const r = obj(raw);
    const p = r && obj(r.product);
    if (!r || r.kind !== OTTA_CONTEXT_KIND || !p || !str(p.name, 80)) return null;
    const hero = obj(p.hero);
    const b = obj(p.brand) ?? {};
    const fo = obj(p.founder) ?? {};
    const fa = obj(p.facts) ?? {};
    const fe = obj(p.feeds) ?? {};
    const li = obj(p.links) ?? {};
    const c = obj(p.copy) ?? {};
    const product: OttaContextProduct = {
        name: str(p.name, 80),
        url: httpUrl(p.url),
        tagline: str(p.tagline, 300),
        stage: str(p.stage, 20),
        launchOn: /^\d{4}-\d{2}-\d{2}$/.test(str(p.launchOn, 10)) ? str(p.launchOn, 10) : null,
        whatItIs: para(p.whatItIs, 4000),
        whoItIsFor: str(p.whoItIsFor, 600),
        problem: para(p.problem, 4000),
        features: strs(p.features),
        pricing: str(p.pricing, 600),
        different: para(p.different, 4000),
        objections: strs(p.objections),
        neverClaim: strs(p.neverClaim),
        positioning: para(p.positioning, 4000),
        keywords: strs(p.keywords),
        hero:
            hero && str(hero.line, 300)
                ? ({ line: str(hero.line, 300), sub: str(hero.sub, 300), button: str(hero.button, 40) } as Hero)
                : null,
        brief: para(p.brief, 20000),
        bio: para(p.bio, 4000),
        contact: str(p.contact, 300),
        log: urlOrNull(p.log),
        feed: urlOrNull(p.feed),
        press: urlOrNull(p.press),
        card: urlOrNull(p.card),
        logo: urlOrNull(p.logo),
        screenshots: strs(p.screenshots, 12, 500).map(httpUrl).filter(Boolean),
        plans: plans(p.plans),
        pricingNote: str(p.pricingNote, 300),
        captions: captions(p.captions),
        sameAs: strs(p.sameAs, 24, 500).map(httpUrl).filter(Boolean),
        docs: urlOrNull(p.docs),
        image: urlOrNull(p.image),
        brand: {
            primary: hexColor(b.primary),
            secondary: hexColor(b.secondary),
            background: hexColor(b.background),
            foreground: hexColor(b.foreground),
            fontHeading: str(b.fontHeading, 80),
            fontBody: str(b.fontBody, 80),
            logo: urlOrNull(b.logo) ?? urlOrNull(p.logo),
            logoDark: urlOrNull(b.logoDark),
            wordmark: urlOrNull(b.wordmark),
            icon: urlOrNull(b.icon),
            naming: str(b.naming, 300),
            pronounce: str(b.pronounce, 80),
        },
        founder: {
            name: str(fo.name, 80),
            title: str(fo.title, 80),
            url: urlOrNull(fo.url),
            bio: para(fo.bio, 4000) || para(p.bio, 4000),
            bioShort: str(fo.bioShort, 300),
            photo: urlOrNull(fo.photo),
            place: str(fo.place, 80),
            socials: socials(fo.socials),
        },
        facts: {
            founded: str(fa.founded, 40),
            location: str(fa.location, 80),
            team: str(fa.team, 80),
            category: str(fa.category, 80),
            platforms: strs(fa.platforms, 16, 30),
            license: str(fa.license, 60),
            stack: str(fa.stack, 200),
        },
        feeds: Object.fromEntries(FEED_KEYS.map((k) => [k, urlOrNull(fe[k])])) as WireFeeds,
        links: Object.fromEntries(LINK_KEYS.map((k) => [k, urlOrNull(li[k])])) as WireLinks,
        copy: {
            short: str(c.short, 600),
            medium: para(c.medium, 2000),
            long: para(c.long, 4000),
            boilerplate: para(c.boilerplate, 2000),
            taglines: strs(c.taglines, 12, 120),
            quotes: strs(c.quotes, 6, 400),
            angles: strs(c.angles, 6, 300),
            story: para(c.story, 4000),
            notA: strs(c.notA, 8, 200),
            milestones: strs(c.milestones, 24, 200),
            coverage: strs(c.coverage, 24, 300),
            metaTitle: str(c.metaTitle, 120),
            metaDescription: str(c.metaDescription, 300),
        },
    };
    // A version 1 file's press-kit addresses stand in where the links block is silent.
    if (!product.links.press && product.press) product.links.press = product.press;
    if (!product.links.card && product.card) product.links.card = product.card;
    if (!product.feeds.log && product.feed) product.feeds.log = product.feed;
    const version = Number.isInteger(r.version) && (r.version as number) > 0 ? (r.version as number) : 1;
    return {
        version,
        kind: OTTA_CONTEXT_KIND,
        at: str(r.at, 40),
        from: str(r.from, 500),
        scope: r.scope === 'owner' ? 'owner' : 'public',
        hash: /^[0-9a-f]{8,16}$/.test(str(r.hash, 16)) ? str(r.hash, 16) : contextHash(product),
        product,
    };
}
