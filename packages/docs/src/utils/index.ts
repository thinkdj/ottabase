import type { DocGroup, DocPage, DocsSource, TocItem } from '../types';

/** Extract a title from markdown content (first # heading) */
export function extractTitle(content: string): string {
    // Strip BOM and zero-width chars that may appear at file start
    const clean = content.replace(/^\uFEFF/, '');
    const match = clean.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled';
}

/** Convert a filename to a URL-friendly slug */
export function fileNameToSlug(fileName: string): string {
    return fileName
        .replace(/\.(md|mdx)$/i, '')
        .replace(/README/i, 'index')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** Convert a slug to a display title */
export function slugToTitle(slug: string): string {
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/^Index$/, 'Overview');
}

/** Extract table of contents from markdown content */
export function extractToc(content: string): TocItem[] {
    const items: TocItem[] = [];
    const lines = content.split('\n');
    const usedIds = new Map<string, number>();
    let inCodeBlock = false;

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) continue;

        const match = line.match(/^(#{2,4})\s+(.+)$/);
        if (match) {
            const level = match[1].length;
            const text = match[2].replace(/[*_`\[\]]/g, '').trim();
            let id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-');
            // Deduplicate IDs for repeated headings (must match renderMarkdown logic)
            const count = usedIds.get(id) || 0;
            usedIds.set(id, count + 1);
            if (count > 0) id = `${id}-${count}`;
            items.push({ id, text, level });
        }
    }
    return items;
}

/** Organize pages into groups */
export function organizePages(sources: DocsSource[]): DocGroup[] {
    const groupMap = new Map<string, DocGroup>();

    for (const source of sources) {
        const groupLabel = source.label;
        const existing = groupMap.get(groupLabel);

        if (existing) {
            existing.pages.push(...source.pages);
        } else {
            groupMap.set(groupLabel, {
                label: groupLabel,
                order: source.order ?? 0,
                pages: [...source.pages],
            });
        }
    }

    // Sort pages within each group
    for (const group of groupMap.values()) {
        group.pages.sort((a, b) => {
            // index pages first
            if (a.slug === 'index' || a.slug.endsWith('/index')) return -1;
            if (b.slug === 'index' || b.slug.endsWith('/index')) return 1;
            return (a.order ?? 50) - (b.order ?? 50);
        });
    }

    return Array.from(groupMap.values()).sort((a, b) => a.order - b.order);
}

/** Find a page by its slug across all sources */
export function findPageBySlug(sources: DocsSource[], slug: string): DocPage | undefined {
    for (const source of sources) {
        const basePath = source.basePath || '';
        for (const page of source.pages) {
            const fullSlug = basePath ? `${basePath}/${page.slug}` : page.slug;
            if (fullSlug === slug || page.slug === slug) {
                return page;
            }
        }
    }
    return undefined;
}

/** Build a full slug for a page within a source */
export function buildPageSlug(source: DocsSource, page: DocPage): string {
    if (source.basePath) {
        return `${source.basePath}/${page.slug}`;
    }
    return page.slug;
}
