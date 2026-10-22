// llms.txt, for a docs site only. Google's Search ignores the file (changelog, 2026-06-15)
// and no answer engine commits to reading it; crawler logs show it fetched almost never. The
// place it earns its keep is developer documentation read by coding agents, which is why
// Ottabase's own repo has one. A marketing site should not bother.

import { firstParagraph, type ProductFacts } from './facts';

export interface LlmsSection {
    title: string;
    links: { title: string; href: string; note?: string }[];
}

export function llmsTxt(facts: ProductFacts, sections: LlmsSection[]): string {
    const summary = facts.tagline || firstParagraph(facts.whatItIs);
    const out = [`# ${facts.name}`, ''];
    if (summary) out.push(`> ${summary}`, '');
    for (const s of sections) {
        if (!s.links.length) continue;
        out.push(`## ${s.title}`, '');
        for (const l of s.links) out.push(`- [${l.title}](${l.href})${l.note ? `: ${l.note}` : ''}`);
        out.push('');
    }
    return out.join('\n');
}
