// ============================================================
// JSON-LD: Organization, WebSite, SoftwareApplication
// ============================================================
// For rich results, not for answer engines: Google says no special structured data is
// needed for AI features, and the one causal test (1,885 pages adding JSON-LD against
// controls, 2026) found no AI-citation lift. Fifteen minutes of markup is still the right
// amount, so this is the whole of it. No FAQPage: Google dropped FAQ rich results for most
// sites in 2023 and the markup moves nothing elsewhere; put the questions in the page text.
// ============================================================

import { sanitizeJsonForScript } from '@ottabase/utils/sanitize';
import { firstParagraph, type ProductFacts } from './facts';

type Node = Record<string, unknown>;

/** The founder as a Person: name, title, address, photo, the profiles that are the same person. */
const person = (f: NonNullable<ProductFacts['founder']>): Node => {
    const sameAs = Object.values(f.socials ?? {});
    return {
        '@type': 'Person',
        name: f.name,
        ...(f.url ? { url: f.url } : {}),
        ...(f.title ? { jobTitle: f.title } : {}),
        ...(f.photo ? { image: f.photo } : {}),
        ...(f.place ? { address: f.place } : {}),
        ...(sameAs.length ? { sameAs } : {}),
    };
};

const org = (f: ProductFacts): Node => ({
    '@type': 'Organization',
    '@id': `${f.url}#organization`,
    name: f.name,
    url: f.url,
    ...(f.brand?.logo || f.logo ? { logo: f.brand?.logo ?? f.logo } : {}),
    ...(f.sameAs?.length ? { sameAs: f.sameAs } : {}),
    ...(f.founder ? { founder: person(f.founder) } : {}),
    ...(f.facts?.founded ? { foundingDate: f.facts.founded } : f.launched ? { foundingDate: f.launched } : {}),
    ...(f.facts?.location ? { location: f.facts.location } : {}),
    ...(f.contact && f.contact.includes('@') ? { email: f.contact } : {}),
});

const site = (f: ProductFacts): Node => ({
    '@type': 'WebSite',
    '@id': `${f.url}#website`,
    url: f.url,
    name: f.name,
    publisher: { '@id': `${f.url}#organization` },
});

const offers = (f: ProductFacts): Node[] =>
    (f.pricing?.plans ?? []).map((p) => ({
        '@type': 'Offer',
        name: p.name,
        price: p.price === 'free' ? 0 : p.price,
        priceCurrency: p.currency,
        ...(p.price !== 'free' && p.period !== 'once'
            ? {
                  priceSpecification: {
                      '@type': 'UnitPriceSpecification',
                      price: p.price,
                      priceCurrency: p.currency,
                      billingDuration: 1,
                      unitCode: p.period === 'month' ? 'MON' : 'ANN',
                  },
              }
            : {}),
    }));

const app = (f: ProductFacts): Node => {
    const description = f.tagline ?? firstParagraph(f.whatItIs);
    const o = offers(f);
    const shots = (f.screenshots ?? []).map((s) => (typeof s === 'string' ? s : s.url));
    return {
        '@type': 'SoftwareApplication',
        '@id': `${f.url}#software`,
        name: f.name,
        url: f.url,
        applicationCategory: 'WebApplication',
        ...(f.facts?.category ? { applicationSubCategory: f.facts.category } : {}),
        operatingSystem: f.facts?.platforms?.length ? f.facts.platforms.join(', ') : 'Web',
        ...(f.facts?.license ? { license: f.facts.license } : {}),
        ...(description ? { description } : {}),
        ...(f.image ? { image: f.image } : {}),
        ...(shots.length ? { screenshot: shots } : {}),
        ...(f.features.length ? { featureList: f.features } : {}),
        ...(f.keywords?.length ? { keywords: f.keywords.join(', ') } : {}),
        ...(f.launched ? { datePublished: f.launched } : {}),
        ...(o.length ? { offers: o } : {}),
        ...(f.whoItIsFor ? { audience: { '@type': 'Audience', audienceType: f.whoItIsFor } } : {}),
        author: { '@id': `${f.url}#organization` },
    };
};

/** One graph with the three nodes, ready for `JSON.stringify` or `jsonLdScript`. */
export function jsonLd(facts: ProductFacts): { '@context': 'https://schema.org'; '@graph': Node[] } {
    return { '@context': 'https://schema.org', '@graph': [org(facts), site(facts), app(facts)] };
}

/** The `<script type="application/ld+json">` tag as a string, escaped so no fact can close the tag. */
export const jsonLdScript = (facts: ProductFacts): string =>
    `<script type="application/ld+json">${sanitizeJsonForScript(jsonLd(facts))}</script>`;
