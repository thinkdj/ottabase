// ============================================================
// The documentation corpus: what scripts/build-corpus.mjs writes and the Worker serves
// ============================================================
// Built from the same sources as llms.txt (the start-here pages, docs/, every package
// README) plus the agent skills. Only files that are public in the repository go in.
// The word index is built with it, so the Worker never scans the text.
// ============================================================

export const DOC_KINDS = ['start', 'guide', 'package', 'skill'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const KIND_LABEL: Record<DocKind, string> = {
    start: 'Start here',
    guide: 'Guides',
    package: 'Packages',
    skill: 'Agent skills',
};

export interface CorpusDoc {
    /** Repo-relative path, POSIX separators: `packages/ottaorm/README.md`. Stable, and what the tools take. */
    id: string;
    kind: DocKind;
    title: string;
    /** One line, at most about 200 characters. */
    summary: string;
    /** The Markdown, LF line ends. */
    body: string;
}

/** One section of a page: `[index of its page in docs, start, end, heading, heading level]`, offsets into that page's body. */
export type SectionRow = [doc: number, start: number, end: number, heading: string, level: number];

export interface CorpusIndex {
    sections: SectionRow[];
    /** Every distinct word of the corpus, sorted, joined by a newline. */
    vocab: string;
    /** For the word at the same position in `vocab`: `[section, count, section, count, ...]`. */
    postings: number[][];
}

export interface Corpus extends CorpusIndex {
    /** ISO time of the build. */
    generatedAt: string;
    /** Short commit the docs were read at, when the build ran in a git checkout. */
    revision: string | null;
    docs: CorpusDoc[];
}

const REPO_URL = 'https://github.com/thinkdj/ottabase/blob/main/';

/** Where a person reads the same page. */
export const sourceUrl = (id: string): string => `${REPO_URL}${id.split('/').map(encodeURIComponent).join('/')}`;
