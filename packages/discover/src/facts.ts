// ============================================================
// ProductFacts: the one object everything else is generated from
// ============================================================
// The schema lives in @ottabase/context, the dependency-free package every Otta product reads
// through, so the shape cannot drift between the writer here and the readers in Ottabuzz
// and Imageine. This file keeps the names this package has always exported.
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
} from '@ottabase/context';
