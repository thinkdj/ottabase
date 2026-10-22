// The one description of the product, built only from given facts, to paste wherever a
// profile asks for one: G2, Capterra, AlternativeTo, GitHub, LinkedIn, Product Hunt. An
// entity that reads the same everywhere is the cheap half of being recognised as one.

import { firstSentence, type ProductFacts } from './facts';

export function canonicalParagraph(f: ProductFacts): string {
    const what = f.tagline || firstSentence(f.whatItIs ?? '');
    const whatLine = what
        ? `${f.name} is ${what.charAt(0).toLowerCase()}${what.slice(1).replace(/[.!?]+$/, '')}.`
        : `${f.name}.`;
    const who = f.whoItIsFor ? `It is for ${f.whoItIsFor.replace(/[.!?]+$/, '')}.` : '';
    const year = f.launched ? f.launched.slice(0, 4) : '';
    const by = f.founder ? `Made by ${f.founder.name}${year ? `, since ${year}` : ''}.` : year ? `Since ${year}.` : '';
    return [whatLine, who, by, f.url].filter(Boolean).join(' ');
}
