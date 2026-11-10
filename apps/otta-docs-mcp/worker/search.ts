// ============================================================
// Keyword search over the corpus, section by section
// ============================================================
// The corpus arrives already cut into sections and indexed by word (scripts/indexer.ts), so
// a query reads postings: which sections hold a word, and how often. Rarer words count
// more, a word in the heading or the page title counts extra, and sections holding every
// word of the query win over partial matches. No text is scanned or lowercased per request,
// which keeps a search to about a millisecond of CPU (a scan of the text took 5 to 14).
//
// ponytail: keyword matching, no stemming and no vectors. Good for "how does X work" over
// reference docs; add Vectorize if questions phrased nothing like the docs start to matter.
// ============================================================

import type { Corpus, CorpusDoc, DocKind } from './corpus';

export interface Section {
    doc: CorpusDoc;
    /** Position of `doc` in the corpus. */
    docAt: number;
    /** The heading that opens the section; the page title for text above the first heading. */
    heading: string;
    headingLower: string;
    /** The heading's level, 1 to 3: a section's sub-sections are the deeper ones that follow it. */
    level: number;
    start: number;
    end: number;
}

export interface DocsIndex {
    corpus: Corpus;
    byId: Map<string, CorpusDoc>;
    sections: Section[];
    /** Sections of one page, in page order. */
    sectionsOf: Map<string, Section[]>;
    /** The vocabulary as an array, sorted, aligned with `corpus.postings`. */
    words: string[];
    /** Where each word starts in `corpus.vocab`; one extra entry closes the last. */
    wordStarts: Int32Array;
    /** Title and id of each page, lowercased, by page. */
    titleLower: string[];
}

export interface SearchHit {
    id: string;
    kind: DocKind;
    title: string;
    heading: string;
    excerpt: string;
    score: number;
}

export const textOf = (section: Section): string => section.doc.body.slice(section.start, section.end);

/** The lookup structures over a built corpus. Cheap: no page text is read. */
export function openIndex(corpus: Corpus): DocsIndex {
    const byId = new Map(corpus.docs.map((doc) => [doc.id, doc]));
    const sectionsOf = new Map<string, Section[]>(corpus.docs.map((doc) => [doc.id, []]));
    const sections = corpus.sections.map(([docAt, start, end, heading, level]): Section => {
        const doc = corpus.docs[docAt]!;
        const section = { doc, docAt, heading, headingLower: heading.toLowerCase(), level, start, end };
        sectionsOf.get(doc.id)!.push(section);
        return section;
    });
    const words = corpus.vocab ? corpus.vocab.split('\n') : [];
    const wordStarts = new Int32Array(words.length + 1);
    let at = 0;
    words.forEach((word, i) => {
        wordStarts[i] = at;
        at += word.length + 1;
    });
    wordStarts[words.length] = at;
    const titleLower = corpus.docs.map((doc) => `${doc.title} ${doc.id}`.toLowerCase());
    return { corpus, byId, sections, sectionsOf, words, wordStarts, titleLower };
}

// Words that say nothing about which page is wanted.
const STOPWORDS = new Set(
    'a an and are as at be by can do does for from how i in is it my of on or that the this to use using what when where which with ottabase'.split(
        ' ',
    ),
);
const MAX_TERMS = 8;

/** The query as distinct search words: lowercased runs of letters, digits and `_`, as the index holds them. */
export function queryTerms(query: string): string[] {
    const words = query.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
    const kept = words.filter((word) => word.length >= 2 && !STOPWORDS.has(word));
    // A query made only of stopwords ("how to use it") still searches for something.
    return [...new Set(kept.length ? kept : words)].slice(0, MAX_TERMS);
}

/** Position of `word` in the sorted vocabulary, or -1. */
function wordAt(words: string[], word: string): number {
    let low = 0;
    let high = words.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (words[mid]! === word) return mid;
        if (words[mid]! < word) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}

/**
 * How often `term` occurs in each section (saturating at 255). A word of up to three letters
 * must stand alone, so "pro" is not found in "provider"; a longer one also counts inside
 * other words ("upload" in "ottaupload", "queue" in "queues"), which is how package names
 * and plurals are found. That containment is one walk over the vocabulary, not the corpus.
 */
function occurrences(index: DocsIndex, term: string): Uint8Array {
    const counts = new Uint8Array(index.sections.length);
    const add = (word: number) => {
        const postings = index.corpus.postings[word]!;
        for (let i = 0; i < postings.length; i += 2) {
            const section = postings[i]!;
            counts[section] = Math.min(255, counts[section]! + postings[i + 1]!);
        }
    };
    if (term.length <= 3) {
        const word = wordAt(index.words, term);
        if (word !== -1) add(word);
        return counts;
    }
    const { vocab } = index.corpus;
    let word = 0;
    let last = -1;
    for (let at = vocab.indexOf(term); at !== -1; at = vocab.indexOf(term, at + term.length)) {
        while (index.wordStarts[word + 1]! <= at) word += 1;
        if (word !== last) add(word); // a word that holds the term twice counts once
        last = word;
    }
    return counts;
}

/** About `width` characters around the first match of `term`, on one line. */
function excerptOf(section: Section, term: string, width = 240): string {
    const text = textOf(section);
    const lower = text.toLowerCase();
    // A short word was matched standing alone, so the excerpt is centred on it standing alone
    // ("pro", not the "pro" of "provider"). `term` is letters, digits and `_` only: safe in a pattern.
    const found = term.length <= 3 ? lower.search(new RegExp(`\\b${term}\\b`)) : lower.indexOf(term);
    const at = Math.max(0, found);
    const start = Math.max(0, at - Math.floor(width / 3));
    const slice = text
        .slice(start, start + width)
        .replace(/\s+/g, ' ')
        .trim();
    return `${start > 0 ? '…' : ''}${slice}${start + width < text.length ? '…' : ''}`;
}

export interface SearchOptions {
    kind?: DocKind;
    limit?: number;
}

/** Sections that get the exact-phrase check: the best by words alone. */
const PHRASE_POOL = 40;

/** The best sections for a query, at most two per page so one long README cannot fill the list. */
export function search(index: DocsIndex, query: string, options: SearchOptions = {}): SearchHit[] {
    const terms = queryTerms(query);
    if (terms.length === 0) return [];
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
    const total = index.sections.length;

    const counts = terms.map((term) => occurrences(index, term));
    // How rare a word is across the sections decides how much finding it is worth.
    const rarity = counts.map((row) => {
        let containing = 0;
        for (let i = 0; i < total; i++) if (row[i]! > 0) containing += 1;
        return Math.log(1 + total / (1 + containing));
    });
    const inTitle = terms.map((term) => index.titleLower.map((title) => title.includes(term)));

    const scored: Array<{ at: number; score: number; best: number }> = [];
    for (let i = 0; i < total; i++) {
        const section = index.sections[i]!;
        if (options.kind && section.doc.kind !== options.kind) continue;
        let score = 0;
        let matched = 0;
        let best = -1;
        for (let t = 0; t < terms.length; t++) {
            const tf = counts[t]![i]!;
            const titled = inTitle[t]![section.docAt]!;
            if (tf === 0 && !titled) continue;
            matched += 1;
            const inHeading = tf > 0 && section.headingLower.includes(terms[t]!);
            score += rarity[t]! * (tf / (tf + 1.5) + (inHeading ? 1.5 : 0) + (titled ? 1 : 0));
            if (tf > 0 && (best === -1 || rarity[t]! > rarity[best]!)) best = t;
        }
        // A page whose title matches is a candidate through its sections that hold a word, not through all of them.
        if (best === -1) continue;
        // A section with every word beats two sections with half each.
        score *= (matched / terms.length) ** 2;
        scored.push({ at: i, score, best });
    }
    scored.sort((a, b) => b.score - a.score);

    // The words in the order they were asked for, side by side, is the strongest signal: checked on the leaders only.
    const phrase = query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (terms.length > 1) {
        const leaders = scored.slice(0, PHRASE_POOL);
        for (const entry of leaders) {
            if (textOf(index.sections[entry.at]!).toLowerCase().includes(phrase)) entry.score += 2;
        }
        leaders.sort((a, b) => b.score - a.score);
        scored.splice(0, leaders.length, ...leaders);
    }

    const perDoc = new Map<string, number>();
    const hits: SearchHit[] = [];
    for (const { at, score, best } of scored) {
        const section = index.sections[at]!;
        const seen = perDoc.get(section.doc.id) ?? 0;
        if (seen >= 2) continue;
        perDoc.set(section.doc.id, seen + 1);
        hits.push({
            id: section.doc.id,
            kind: section.doc.kind,
            title: section.doc.title,
            heading: section.heading,
            excerpt: excerptOf(section, terms[best]!),
            score: Math.round(score * 100) / 100,
        });
        if (hits.length === limit) break;
    }
    return hits;
}

/**
 * The page an id names. Exact first; then the forgiving forms an agent tends to try: a
 * package name (`ottaorm`, `@ottabase/ottaorm`), a skill name, a file name, any case.
 */
export function resolveDoc(index: DocsIndex, raw: string): CorpusDoc | null {
    const id = raw
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '');
    const exact = index.byId.get(id);
    if (exact) return exact;
    const wanted = id.toLowerCase().replace(/^@ottabase\//, '');
    const candidates = [
        `packages/${wanted}/readme.md`,
        `.claude/skills/${wanted}/skill.md`,
        `docs/${wanted}`,
        `docs/${wanted}.md`,
        wanted,
        `${wanted}.md`,
    ];
    for (const doc of index.corpus.docs) {
        if (candidates.includes(doc.id.toLowerCase())) return doc;
    }
    return null;
}

// Path words every id shares: they say nothing about which page was meant.
const GENERIC = new Set(['packages', 'readme', 'md', 'docs', 'skills', 'skill', 'claude', 'ottabase']);
const nameWords = (value: string): string[] =>
    (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length >= 3 && !GENERIC.has(word));

/** Pages whose id or title is close to a wrong id (`packages/queues/README.md` → the queue README), best first. */
export function nearestDocs(index: DocsIndex, raw: string, limit = 5): CorpusDoc[] {
    const wanted = nameWords(raw);
    if (wanted.length === 0) return [];
    return index.corpus.docs
        .map((doc) => {
            const names = nameWords(`${doc.id} ${doc.title}`);
            const score = wanted.filter((word) => names.some((name) => name.includes(word) || word.includes(name)));
            return { doc, score: score.length };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.doc);
}
