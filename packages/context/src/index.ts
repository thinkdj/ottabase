// ============================================================
// @ottabase/context: one file that says what a product is
// ============================================================
// The otta-context schema, version 2, shared by every Otta product and open to anyone. An
// Ottabase app serves it at /.well-known/otta.json (through @ottabase/discover), Ottabuzz
// serves it as context.json, Imageine and Tuskly import it. No dependencies; runs in a
// Worker, Node and the browser.
// ============================================================

export {
    OTTA_CONTEXT_KIND,
    OTTA_CONTEXT_VERSION,
    OTTA_FOUNDER_KIND,
    OTTA_JSON_PATH,
    type Brand,
    type Copy,
    type Facts,
    type Feeds,
    type Founder,
    type FounderProduct,
    type Hero,
    type Links,
    type OttaContext,
    type OttaContextProduct,
    type OttaFounder,
    type Plan,
    type PlanPeriod,
    type Pricing,
    type ProductFacts,
    type Scope,
    type Screenshot,
    type Stage,
    type WireBrand,
    type WireCopy,
    type WireFacts,
    type WireFeeds,
    type WireFounder,
    type WireLinks,
} from './types';
export {
    defineProduct,
    firstParagraph,
    firstSentence,
    hexColor,
    httpUrl,
    priceWords,
    pricingLine,
    FEED_KEYS,
    LINK_KEYS,
} from './facts';
export {
    canonical,
    contextHash,
    emptyBrand,
    emptyCopy,
    emptyFacts,
    emptyFeeds,
    emptyFounder,
    emptyLinks,
    hashText,
    ottaJson,
    parseOttaJson,
    productOf,
} from './json';
export { founderJson, parseFounderJson, type FounderFacts } from './founder';
export { fetchOtta, inherit, ottaJsonUrl, type Fetched, type FetchOptions } from './fetch';
