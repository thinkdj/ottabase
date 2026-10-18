/**
 * Assembly: turn a {@link LegalConfig} plus a document id into a fully interpolated, conditionally filtered,
 * override-applied {@link AssembledLegalDocument}.
 */

import { buildVars, interpolate, lastUpdatedFor } from './interpolate';
import { docEnabled, docIdOfSlug, LEGAL_DOC_ORDER, LEGAL_DOCS } from './registry';
import { extractToc } from './toc';
import type {
    AssembledLegalDocument,
    LegalConfig,
    LegalDocId,
    LegalDocMeta,
    LegalSection,
    LegalSectionOverrides,
} from './types';

/** Apply per-app overrides: remove, then replace, then prepend and append. */
function applyOverrides(sections: LegalSection[], overrides?: LegalSectionOverrides): LegalSection[] {
    if (!overrides) return sections;
    let result = sections;
    if (overrides.remove?.length) {
        const drop = new Set(overrides.remove);
        result = result.filter((s) => !drop.has(s.id));
    }
    if (overrides.replace) {
        const replace = overrides.replace;
        result = result.map((s) => (replace[s.id] ? { ...s, ...replace[s.id] } : s));
    }
    return [...(overrides.prepend ?? []), ...result, ...(overrides.append ?? [])];
}

/**
 * Build a single document. Throws on an unknown `docId`. Producing a disabled document is allowed; call
 * {@link docEnabled} first if you want to gate on that.
 */
export function assembleLegalDocument(docId: LegalDocId, config: LegalConfig): AssembledLegalDocument {
    const def = Object.prototype.hasOwnProperty.call(LEGAL_DOCS, docId) ? LEGAL_DOCS[docId] : undefined;
    if (!def) throw new Error(`Unknown legal document: ${docId}`);

    const vars = buildVars(config, docId);
    const sections = applyOverrides(def.sections, config.overrides?.[docId]).filter((s) =>
        s.when ? s.when(config) : true,
    );

    const blocks: string[] = [];
    for (const section of sections) {
        const parts: string[] = [];
        if (section.title) parts.push(`## ${interpolate(section.title, vars).trim()}`);
        // Interpolation can leave an empty line behind (an unset address): collapse runs of blank lines.
        const body = interpolate(section.body, vars)
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        if (body) parts.push(body);
        if (parts.length) blocks.push(parts.join('\n\n'));
    }
    // A section that is only list items continues the list before it (a conditional bullet), so one list renders.
    const markdown = blocks
        .reduce<string[]>((acc, b) => {
            const prev = acc[acc.length - 1];
            if (prev && /^- /.test(prev.split('\n').pop() ?? '') && /^- /.test(b))
                acc[acc.length - 1] = `${prev}\n${b}`;
            else acc.push(b);
            return acc;
        }, [])
        .join('\n\n');
    const copyrightYear = config.copyrightYear ?? new Date().getFullYear();
    // No double period when the legal entity ends in "Inc." or "Ltd.".
    const companyName = config.companyName.replace(/\.\s*$/, '');

    return {
        id: docId,
        slug: def.slug,
        title: interpolate(def.title, vars),
        lastUpdated: lastUpdatedFor(config, docId),
        markdown,
        toc: extractToc(markdown),
        copyright: `© ${copyrightYear} ${companyName}. All rights reserved.`,
    };
}

/** The documents enabled for this config, in display order, for a nav, footer or index. */
export function listLegalDocuments(config: LegalConfig): LegalDocMeta[] {
    return LEGAL_DOC_ORDER.filter((id) => docEnabled(id, config)).map((id) => ({
        id,
        slug: LEGAL_DOCS[id].slug,
        title: interpolate(LEGAL_DOCS[id].title, buildVars(config, id)),
    }));
}

/** Resolve a URL slug (such as "privacy") to an enabled document id, or null. */
export function resolveLegalSlug(slug: string, config: LegalConfig): LegalDocId | null {
    const id = docIdOfSlug(slug);
    return id && docEnabled(id, config) ? id : null;
}
