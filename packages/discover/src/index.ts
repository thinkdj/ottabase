// ============================================================
// @ottabase/discover: AI-readable by default
// ============================================================
// Headless entry: the facts, and every file generated from them. Rendered React lives in
// `@ottabase/discover/next`; the Worker manifest in `@ottabase/discover/manifest`.
// ============================================================

export {
    defineProduct,
    firstParagraph,
    firstSentence,
    httpUrl,
    priceWords,
    pricingLine,
    type Brand,
    type Copy,
    type Facts,
    type Feeds,
    type Founder,
    type Hero,
    type Links,
    type Plan,
    type PlanPeriod,
    type Pricing,
    type ProductFacts,
    type Screenshot,
    type Stage,
} from './facts';
export { brandFromTheme, cssColorToHex, fontFamilyName, type ThemeLike } from './brand';
export { isOwnerKey, OWNER_KEY_PARAM } from './responses';
export {
    AI_SEARCH_BOTS,
    AI_TRAINING_BOTS,
    robotsRules,
    robotsTxt,
    type RobotsOptions,
    type RobotsRule,
    type RobotsRules,
} from './robots';
export { sitemapXml, type SitemapEntry } from './sitemap';
export {
    contextHash,
    OTTA_CONTEXT_KIND,
    OTTA_CONTEXT_VERSION,
    OTTA_JSON_PATH,
    ottaJson,
    parseOttaJson,
    type OttaContext,
    type OttaContextProduct,
    type Scope,
} from './otta-json';
export { jsonLd, jsonLdScript } from './json-ld';
export { canonicalParagraph } from './paragraph';
export { llmsTxt, type LlmsSection } from './llms';
