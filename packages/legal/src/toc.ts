/** Derive a table of contents from the `##` and `###` headings in a Markdown string. */

import { makeHeadingSlugger } from './interpolate';
import type { TocItem } from './types';

export function extractToc(markdown: string): TocItem[] {
    const slug = makeHeadingSlugger();
    const items: TocItem[] = [];
    for (const line of markdown.split('\n')) {
        const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
        if (!m) continue;
        const level = m[1].length;
        const text = m[2].replace(/[`*_]/g, '').trim();
        items.push({ id: slug(text), text, level });
    }
    return items;
}
