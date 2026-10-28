// ============================================================
// otta-context, version 2: the shapes
// ============================================================
// Two shapes. `ProductFacts` is what an author writes or derives: a config file, a database
// row, a form, Ottabuzz's brief and kit. `OttaContext` is the wire document every tool reads:
// `/.well-known/otta.json` on a product's site, `context.json` on Ottabuzz. Version 1 fields
// keep their names and positions so a version 1 reader keeps working; version 2 adds blocks
// (plans, brand, founder, facts, feeds, links, copy) and a content hash. In the wire shape
// every field is present, a string is '' when unset, a list is [] and an address is null, so
// a consumer never checks for a missing key.
// ============================================================

export const OTTA_CONTEXT_VERSION = 2;
export const OTTA_CONTEXT_KIND = 'otta-context';
export const OTTA_FOUNDER_KIND = 'otta-founder';
export const OTTA_JSON_PATH = '/.well-known/otta.json';

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

export type Stage = 'idea' | 'building' | 'launched' | 'users';

/** The landing page's first screen: a line, a line under it, a button. */
export interface Hero {
    line: string;
    sub?: string;
    button?: string;
}

/** The brand's few rules, enough for a designer at a newsletter to get it right without asking. Colours are #rrggbb,
 *  fonts are family names, marks are absolute addresses. */
export interface Brand {
    primary?: string;
    secondary?: string;
    background?: string;
    foreground?: string;
    fontHeading?: string;
    fontBody?: string;
    /** The mark, the mark for dark surfaces, the name set in type, a small icon. */
    logo?: string;
    logoDark?: string;
    wordmark?: string;
    icon?: string;
    /** How the name is written ("Ottabuzz, one word"), and how it is said. */
    naming?: string;
    pronounce?: string;
}

export interface Founder {
    name: string;
    title?: string;
    url?: string;
    /** Two or three sentences in the third person, and the same in one. */
    bio?: string;
    bioShort?: string;
    /** A square photo, absolute. */
    photo?: string;
    place?: string;
    /** Network key ("x", "github", "linkedin") to the profile's absolute address. */
    socials?: Record<string, string>;
}

/** What every form, directory and writer asks for, as plain words. */
export interface Facts {
    founded?: string;
    /** A city, a country, or "www" for a product that lives nowhere in particular. */
    location?: string;
    team?: string;
    category?: string;
    platforms?: string[];
    license?: string;
    stack?: string;
}

/** Where the product's time-based data is: RSS, Atom or JSON Feed addresses. */
export interface Feeds {
    blog?: string;
    releases?: string;
    changelog?: string;
    /** The founder's build log, when it is not the blog. */
    log?: string;
}

/** The other places this product lives, so a tool that has one address can find the rest. */
export interface Links {
    docs?: string;
    repo?: string;
    pricing?: string;
    changelog?: string;
    status?: string;
    /** The press kit page, the same as Markdown, and everything as a ZIP. */
    press?: string;
    pressMarkdown?: string;
    pressZip?: string;
    /** Another context file for the same product (a product's site pointing at its Ottabuzz file, or back). */
    context?: string;
    /** A brand file (Imageine's kit), when there is one. */
    brand?: string;
    /** The 1200 by 630 social card. */
    card?: string;
}

export interface Screenshot {
    url: string;
    caption?: string;
}

/** The press kit's copy: what a writer pastes. Written by the founder or a model, never derived from code. */
export interface Copy {
    short?: string;
    medium?: string;
    long?: string;
    boilerplate?: string;
    taglines?: string[];
    /** In the founder's first person, approved by them. */
    quotes?: string[];
    angles?: string[];
    story?: string;
    /** "Not a ..." lines. */
    notA?: string[];
    /** Dated lines, the date first. */
    milestones?: string[];
    /** "Title https://..." lines. */
    coverage?: string[];
    metaTitle?: string;
    metaDescription?: string;
}

/** What an author writes or derives. Every field but name and url is optional, and a missing fact stays missing. */
export interface ProductFacts {
    name: string;
    /** The product's own site, absolute. */
    url: string;
    tagline?: string;
    /** One or two paragraphs, blank line between them. */
    whatItIs?: string;
    whoItIsFor?: string;
    problem?: string;
    features: string[];
    pricing?: Pricing;
    /** Pricing as one line, for a writer that has the words and not the plans (a brief). The plans win when both. */
    pricingText?: string;
    /** What makes it different, one paragraph. */
    different?: string;
    positioning?: string;
    /** "Objection: the honest answer" lines. */
    objections?: string[];
    /** What copy about the product must never claim. Kept out of the public file; served to the owner only. */
    neverClaim?: string[];
    founder?: Founder;
    brand?: Brand;
    facts?: Facts;
    feeds?: Feeds;
    links?: Links;
    copy?: Copy;
    /** The mark, absolute. The brand block's `logo` wins when both are set. */
    logo?: string;
    /** The 1200 by 630 social image, absolute. */
    image?: string;
    screenshots?: (string | Screenshot)[];
    /** Profiles that are the same entity: GitHub, X, LinkedIn, Product Hunt, Crunchbase. */
    sameAs?: string[];
    /** An email or a URL. */
    contact?: string;
    /** ISO date, "2026-03-01". */
    launched?: string;
    keywords?: string[];
    docsUrl?: string;
    stage?: Stage;
    hero?: Hero;
    /** The whole brief as Markdown, when the author keeps one (Ottabuzz). Owner scope only. */
    brief?: string;
    /** When the facts last changed, ISO. The file's `at` when given; the hash says the rest. */
    updatedAt?: string;
}

/** The brand, founder, facts, feeds, links and copy blocks as the wire carries them: every key present. */
export interface WireBrand {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    fontHeading: string;
    fontBody: string;
    logo: string | null;
    logoDark: string | null;
    wordmark: string | null;
    icon: string | null;
    naming: string;
    pronounce: string;
}
export interface WireFounder {
    name: string;
    title: string;
    url: string | null;
    bio: string;
    bioShort: string;
    photo: string | null;
    place: string;
    socials: Record<string, string>;
}
export interface WireFacts {
    founded: string;
    location: string;
    team: string;
    category: string;
    platforms: string[];
    license: string;
    stack: string;
}
export type WireFeeds = Record<keyof Feeds, string | null>;
export type WireLinks = Record<keyof Links, string | null>;
export interface WireCopy {
    short: string;
    medium: string;
    long: string;
    boilerplate: string;
    taglines: string[];
    quotes: string[];
    angles: string[];
    story: string;
    notA: string[];
    milestones: string[];
    coverage: string[];
    metaTitle: string;
    metaDescription: string;
}

/** The product as the wire carries it. The first group is version 1, unchanged; the rest is version 2. */
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
    /** Pricing as one plain line; `plans` has the same as data. */
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
    // Version 2.
    plans: Plan[];
    pricingNote: string;
    /** A caption per screenshot address. */
    captions: Record<string, string>;
    sameAs: string[];
    docs: string | null;
    image: string | null;
    brand: WireBrand;
    founder: WireFounder;
    facts: WireFacts;
    feeds: WireFeeds;
    links: WireLinks;
    copy: WireCopy;
}

export type Scope = 'public' | 'owner';

export interface OttaContext {
    version: number;
    kind: typeof OTTA_CONTEXT_KIND;
    /** When the facts were written, ISO. */
    at: string;
    /** This file's own address. */
    from: string;
    /** Whether the writer-only fields (neverClaim, the brief) are in it. */
    scope: Scope;
    /** A hash of `product`: the same facts give the same hash, whoever wrote the file and whenever. */
    hash: string;
    product: OttaContextProduct;
}

/** One product in a founder manifest: enough to list it, and where its own file is. */
export interface FounderProduct {
    name: string;
    url: string;
    tagline: string;
    stage: string;
    /** The product's context file, when it has one. */
    context: string | null;
}

/** The founder manifest: one file on the founder's own domain that names the person and every product. */
export interface OttaFounder {
    version: number;
    kind: typeof OTTA_FOUNDER_KIND;
    at: string;
    from: string;
    hash: string;
    founder: WireFounder;
    products: FounderProduct[];
}
