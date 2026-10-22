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

const org = (f: ProductFacts): Node => ({
    '@type': 'Organization',
    '@id': `${f.url}#organization`,
    name: f.name,
    url: f.url,
    ...(f.logo ? { logo: f.logo } : {}),
    ...(f.sameAs?.length ? { sameAs: f.sameAs } : {}),
    ...(f.founder
        ? { founder: { '@type': 'Person', name: f.founder.name, ...(f.founder.url ? { url: f.founder.url } : {}) } }
        : {}),
    ...(f.launched ? { foundingDate: f.launched } : {}),
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
    return {
        '@type': 'SoftwareApplication',
        '@id': `${f.url}#software`,
        name: f.name,
        url: f.url,
        applicationCategory: 'WebApplication',
        operatingSystem: 'Web',
        ...(description ? { description } : {}),
        ...(f.image ? { image: f.image } : {}),
        ...(f.screenshots?.length ? { screenshot: f.screenshots } : {}),
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
