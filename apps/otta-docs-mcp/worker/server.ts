// ============================================================
// The MCP server: three read-only tools over the documentation
// ============================================================
// Everything here reads the bundled corpus and nothing else: no account, no upstream API, no
// state. Each tool carries a title and `readOnlyHint`, which the Claude connector directory
// requires, and answers a bad argument with what to try next, never a bare error.
//
// "No such page" and "no such section" are answers, not errors: the reply names the closest
// pages or the sections that exist, and the assistant carries on. They are deliberately not
// `isError`, which the directory counts as a failed call in a connector's health. Only an
// argument that fails its schema is an error, and the SDK reports that one itself.
// ============================================================

import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { DOC_KINDS, KIND_LABEL, sourceUrl, type CorpusDoc, type DocKind } from './corpus';
import { nearestDocs, resolveDoc, search, type DocsIndex, type Section } from './search';

export const SERVER_NAME = 'ottabase-docs';
/** What clients are told. Bump it when a tool's name, arguments or behaviour changes. */
export const SERVER_VERSION = '1.0.0';

/** A page longer than this comes back as an outline plus its first part. About 4,000 tokens. */
export const MAX_DOC_CHARS = 16_000;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

const kindSchema = z
    .enum(DOC_KINDS)
    .describe('start: getting-started pages. guide: topic guides. package: package READMEs. skill: agent skills.');

function line(doc: CorpusDoc, withSummary: boolean): string {
    return withSummary && doc.summary ? `- ${doc.id}: ${doc.title}. ${doc.summary}` : `- ${doc.id}: ${doc.title}`;
}

function listing(index: DocsIndex, kind?: DocKind): string {
    const kinds = kind ? [kind] : DOC_KINDS;
    const parts: string[] = [];
    for (const each of kinds) {
        const docs = index.corpus.docs.filter((doc) => doc.kind === each);
        parts.push(`## ${KIND_LABEL[each]} (${docs.length})`, '', ...docs.map((doc) => line(doc, Boolean(kind))), '');
    }
    return parts.join('\n').trim();
}

/** Positions of the sections a `section` argument names: an exact heading first, then headings that contain it. */
function matchSections(sections: Section[], wanted: string): number[] {
    const needle = wanted
        .trim()
        .toLowerCase()
        .replace(/^#+\s*/, '');
    const where = (test: (section: Section) => boolean) => sections.flatMap((section, i) => (test(section) ? [i] : []));
    const exact = where((section) => section.headingLower === needle);
    return exact.length ? exact : where((section) => section.headingLower.includes(needle));
}

/** The page's headings, indented by level, so a sub-section reads as part of its section. */
function outline(sections: Section[]): string {
    const lines = sections.map((section) => `${'  '.repeat(section.level - 1)}- ${section.heading}`);
    return [...new Set(lines)].join('\n');
}

/**
 * A section as a person means it: its own text and every deeper section under it, up to the
 * next heading of the same level or above. Asking for "Row level security" returns the whole
 * part, not only the two lines before its first sub-heading.
 */
function sectionText(doc: CorpusDoc, sections: Section[], matched: number[]): string {
    const parts: string[] = [];
    let covered = -1;
    for (const at of matched) {
        if (at <= covered) continue; // a sub-section of one already taken
        let last = at;
        while (last + 1 < sections.length && sections[last + 1]!.level > sections[at]!.level) last += 1;
        parts.push(doc.body.slice(sections[at]!.start, sections[last]!.end));
        covered = last;
    }
    return parts.join('\n\n');
}

function page(index: DocsIndex, doc: CorpusDoc, section?: string): string {
    const sections = index.sectionsOf.get(doc.id) ?? [];
    const header = `# ${doc.title}\n\nid: ${doc.id}\nsource: ${sourceUrl(doc.id)}\n`;
    if (section) {
        const found = matchSections(sections, section);
        if (found.length === 0) {
            return `No section "${section}" in ${doc.id}. Its sections are:\n${outline(sections)}`;
        }
        const body = sectionText(doc, sections, found);
        return body.length > MAX_DOC_CHARS
            ? `${header}\n${body.slice(0, MAX_DOC_CHARS)}\n\n[Cut at ${MAX_DOC_CHARS} characters. Read the rest at the source link.]`
            : `${header}\n${body}`;
    }
    if (doc.body.length <= MAX_DOC_CHARS) return `${header}\n${doc.body}`;
    return [
        header,
        `This page is ${doc.body.length} characters, so only its first part follows. Pass \`section\` with one of these headings to read that part:`,
        outline(sections),
        '',
        '---',
        '',
        doc.body.slice(0, MAX_DOC_CHARS),
    ].join('\n');
}

export function createDocsServer(index: DocsIndex): McpServer {
    const server = new McpServer(
        { name: SERVER_NAME, title: 'Ottabase Docs', version: SERVER_VERSION },
        {
            instructions:
                'Read-only access to the public documentation of Ottabase, an open source framework for building SaaS apps on Cloudflare Workers. Document ids are repository paths such as packages/ottaorm/README.md.',
        },
    );

    server.registerTool(
        'search_docs',
        {
            title: 'Search Ottabase docs',
            description:
                'Search the Ottabase framework documentation by keyword: package READMEs, guides, the quickstart and architecture pages, and agent skills. Returns the best-matching sections, each with its document id, section heading, a short excerpt and a source link. Use it to find how an Ottabase package, API, CLI command or convention works.',
            inputSchema: z.object({
                query: z
                    .string()
                    .min(2)
                    .max(200)
                    .describe('Keywords, for example "row level security" or "queue retry".'),
                kind: kindSchema.optional().describe('Search one group of pages only.'),
                limit: z.number().int().min(1).max(10).optional().describe('How many sections to return. Default 5.'),
            }),
            annotations: { title: 'Search Ottabase docs', ...READ_ONLY },
        },
        async ({ query, kind, limit }) => {
            const hits = search(index, query, { kind, limit });
            if (hits.length === 0) {
                return text(
                    `No documentation matched "${query}". Try fewer or different keywords, or a package name such as ottaorm, auth, rbac, queue or forms.`,
                );
            }
            const blocks = hits.map(
                (hit, i) =>
                    `${i + 1}. ${hit.title} > ${hit.heading}\n   id: ${hit.id}\n   kind: ${hit.kind}\n   source: ${sourceUrl(hit.id)}\n   ${hit.excerpt}`,
            );
            return text(`${hits.length} matching sections for "${query}":\n\n${blocks.join('\n\n')}`);
        },
    );

    server.registerTool(
        'get_doc',
        {
            title: 'Read an Ottabase doc',
            description:
                'Read one Ottabase documentation page as Markdown, by its document id (a repository path such as packages/ottaorm/README.md, as returned by search_docs and list_docs). A package name such as "ottaorm" is accepted too. A long page returns an outline and its first part; pass `section` with a heading from the outline to read that part.',
            inputSchema: z.object({
                id: z
                    .string()
                    .min(1)
                    .max(200)
                    .describe('Document id, for example packages/ottaorm/README.md or docs/TESTING.md.'),
                section: z
                    .string()
                    .min(1)
                    .max(200)
                    .optional()
                    .describe('A section heading, to read only that part of the page.'),
            }),
            annotations: { title: 'Read an Ottabase doc', ...READ_ONLY },
        },
        async ({ id, section }) => {
            const doc = resolveDoc(index, id);
            if (!doc) {
                const near = nearestDocs(index, id);
                const hint = near.length
                    ? ` Closest pages:\n${near.map((each) => `- ${each.id}: ${each.title}`).join('\n')}`
                    : ' list_docs returns every document id.';
                return text(`No document with id "${id}".${hint}`);
            }
            return text(page(index, doc, section));
        },
    );

    server.registerTool(
        'list_docs',
        {
            title: 'List Ottabase docs',
            description:
                'List the Ottabase documentation pages by group: getting-started pages, guides, package READMEs and agent skills, each with its document id and title. Pass `kind` to list one group with a one-line summary of every page in it.',
            inputSchema: z.object({
                kind: kindSchema.optional().describe('List one group, with summaries. Omit for every id and title.'),
            }),
            annotations: { title: 'List Ottabase docs', ...READ_ONLY },
        },
        async ({ kind }) => text(listing(index, kind)),
    );

    return server;
}
