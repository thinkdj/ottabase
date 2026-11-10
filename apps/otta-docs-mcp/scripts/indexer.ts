// ============================================================
// Build-time indexing: pages into sections, sections into a word index
// ============================================================
// Runs in scripts/build-corpus.mjs (Node strips the types), never in the Worker. Doing this
// once at build time is what keeps a request to about a millisecond of CPU: the
// Worker reads postings, it never scans or lowercases the corpus.
//
// Keep this file free of runtime imports and of TypeScript that needs compiling (enums,
// parameter properties): Node runs it as is.
// ============================================================

import type { CorpusDoc, CorpusIndex, SectionRow } from '../worker/corpus';

// A fence line, or a heading of level 1 to 3. One pass over the page finds both.
const MARK = /^[ \t]*(```|~~~)|^(#{1,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;

/**
 * A page as its sections: `[start, end, heading, level]`, offsets into the body with the
 * blank edges trimmed off and the heading's level (1 to 3). Cut at headings, never inside a
 * code fence. Text above the first heading belongs to the page title, at level 1.
 */
export function splitSections(body: string, title: string): Array<[number, number, string, number]> {
    const out: Array<[number, number, string, number]> = [];
    let heading = title;
    let level = 1;
    let from = 0;
    let inFence = false;
    const cut = (to: number) => {
        let start = from;
        let end = to;
        while (start < end && /\s/.test(body[start]!)) start += 1;
        while (end > start && /\s/.test(body[end - 1]!)) end -= 1;
        if (end > start) out.push([start, end, heading, level]);
        from = to;
    };
    for (const match of body.matchAll(MARK)) {
        if (match[1]) inFence = !inFence;
        else if (!inFence) {
            cut(match.index);
            heading = match[3]!.replace(/[*`]/g, '');
            level = match[2]!.length;
        }
    }
    cut(body.length);
    return out;
}

/** The words of a text: runs of letters, digits and `_`, lowercased. One-letter and very long runs (hashes) are noise. */
export function wordsOf(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((word) => word.length >= 2 && word.length <= 40);
}

/** Sections, the sorted vocabulary, and for each word the sections that hold it with how often. */
export function indexDocs(docs: CorpusDoc[]): CorpusIndex {
    const sections: SectionRow[] = [];
    const byWord = new Map<string, number[]>();
    docs.forEach((doc, d) => {
        for (const [start, end, heading, level] of splitSections(doc.body, doc.title)) {
            const at = sections.length;
            sections.push([d, start, end, heading, level]);
            const counts = new Map<string, number>();
            for (const word of wordsOf(doc.body.slice(start, end))) counts.set(word, (counts.get(word) ?? 0) + 1);
            for (const [word, n] of counts) {
                let postings = byWord.get(word);
                if (!postings) byWord.set(word, (postings = []));
                postings.push(at, Math.min(n, 255));
            }
        }
    });
    const words = [...byWord.keys()].sort();
    return { sections, vocab: words.join('\n'), postings: words.map((word) => byWord.get(word)!) };
}
