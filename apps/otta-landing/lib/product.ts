// The product's facts, read from what the admin already wrote: the site settings and the
// published home page. One source feeds robots.txt, /.well-known/otta.json and the JSON-LD,
// so nothing is typed twice and nothing can disagree with the page itself.

import { defineProduct, type Plan, type ProductFacts } from '@ottabase/discover';
import type { LandingPageData, Section, SectionData, SectionType, SiteSettings } from '@ottabase/ottalanding';
import { fileUrl } from '@ottabase/utils/media';
import { cache } from 'react';
import { getPage, getSite, siteOrigin } from './content';

/** The first section of `type` on the page, as its own data shape. */
const section = <T extends SectionType>(sections: Section[], type: T): SectionData<T> | undefined =>
    (sections.find((s) => s.type === type) as Extract<Section, { type: T }> | undefined)?.data as
        | SectionData<T>
        | undefined;

const CURRENCY: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' };

/**
 * "$19", "€9.50", "9,50 €", "USD 1,000", "$19/mo", "Free", "$0" as a price. Null when the text is not
 * exactly one amount ("Contact us", "from $5", "$19–$49"): a price that is not plain is not claimed.
 */
export function money(text: string): Pick<Plan, 'price' | 'currency'> | null {
    const s = text.trim();
    if (/^(free|\$?0(?:[.,]0+)?)$/i.test(s)) return { price: 'free', currency: 'USD' };
    // currency? amount(.decimals)? currency? (/period)?  Thousands groups stay whole: "$1,000" is not $1.
    const m =
        /^([$€£]|[A-Z]{3})?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*([$€£]|[A-Z]{3})?(?:\s*\/\s*[A-Za-z]+)?$/.exec(
            s,
        );
    if (!m || (m[1] && m[4])) return null;
    const sym = m[1] ?? m[4] ?? '$';
    return { price: Number(`${m[2].replace(/,/g, '')}.${m[3] ?? '0'}`), currency: CURRENCY[sym] ?? sym };
}

const period = (text = ''): Plan['period'] =>
    /year|yr|annual/i.test(text) ? 'year' : /once|one[- ]?time|lifetime|forever/i.test(text) ? 'once' : 'month';

/** The facts for a site whose home page is `home`, with every relative address made absolute against `origin`. */
export function productFacts(site: SiteSettings, home: LandingPageData, origin: string): ProductFacts {
    // An address the admin mistyped ("https://[") must not take the home page down: it is simply left out.
    const abs = (u?: string) => (u && URL.canParse(u, origin) ? new URL(u, origin).href : undefined);
    const hero = section(home.sections, 'hero');
    const features = section(home.sections, 'features');
    const pricing = section(home.sections, 'pricing');
    const plans = (pricing?.plans ?? []).flatMap((p) => {
        const m = money(p.price);
        // The period may be typed into the price itself ("$190/year") instead of its own field.
        return m
            ? [{ name: p.name, ...m, period: period(`${p.price} ${p.period ?? ''}`), includes: p.features ?? [] }]
            : [];
    });
    // Outside links in the navigation are the product's own profiles: GitHub, X, LinkedIn.
    const sameAs = [...(site.nav ?? []), ...(site.footerLinks ?? [])]
        .map((l) => l.href)
        .filter((h) => /^https?:\/\//.test(h) && !h.startsWith(origin));
    return defineProduct({
        name: site.name,
        url: origin,
        tagline: site.tagline || hero?.title,
        whatItIs: hero?.subtitle || home.description,
        features: features?.items?.map((i) => `${i.title}: ${i.description}`) ?? [],
        ...(plans.length ? { pricing: { plans } } : {}),
        // Stored images as their originals: one absolute URL that works everywhere.
        logo: abs(fileUrl(site.logo)),
        image: abs(fileUrl(site.share?.image)),
        sameAs: [...new Set(sameAs)],
        ...(hero ? { hero: { line: hero.title, sub: hero.subtitle, button: hero.actions?.[0]?.label } } : {}),
    });
}

/** The facts for this request's site, or null until the site and a published home page exist. */
export const getProductFacts = cache(async (): Promise<ProductFacts | null> => {
    const [site, home] = await Promise.all([getSite(), getPage('/')]);
    if (!site || !home?.published) return null;
    return productFacts(site, home, await siteOrigin(site));
});
