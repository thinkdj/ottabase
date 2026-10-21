/**
 * Small builders for the demo seed fixtures, so the posts read as content rather than as
 * EditorJS plumbing. They emit exactly what OttaEditor saves (lists in the
 * `@editorjs/nested-list` shape), so seeded posts open in the editor unchanged. Blocks used once
 * are written out in full where they appear; `kitchensink-content.json` shows every shape.
 */
import type { EditorJSData, PhotoJournalItem } from '@ottabase/ottablog';

type Block = EditorJSData['blocks'][number];

/** Unsplash's CDN at a given width. Every demo photo is free to use under the Unsplash License. */
export const unsplash = (id: string, width = 1600) =>
    `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format`;

/** An editorial date at noon UTC, so no reader's timezone tips it onto the neighbouring day. */
export const on = (date: string) => Date.parse(`${date}T12:00:00Z`);

export const doc = (...blocks: Block[]): EditorJSData => ({ version: '2.31.0', blocks });

export const p = (text: string): Block => ({ type: 'paragraph', data: { text } });

export const h = (text: string, level = 2): Block => ({ type: 'header', data: { text, level } });

const list = (style: 'ordered' | 'unordered', items: string[]): Block => ({
    type: 'list',
    data: { style, items: items.map((content) => ({ content, items: [] })) },
});
export const ul = (...items: string[]) => list('unordered', items);
export const ol = (...items: string[]) => list('ordered', items);

export const quote = (text: string, caption = ''): Block => ({
    type: 'quote',
    data: { text, caption, alignment: 'left' },
});

export const delimiter: Block = { type: 'delimiter', data: {} };

export const warning = (title: string, message: string): Block => ({ type: 'warning', data: { title, message } });

export const checklist = (...items: Array<[text: string, checked: boolean]>): Block => ({
    type: 'checklist',
    data: { items: items.map(([text, checked]) => ({ text, checked })) },
});

export const table = (...rows: string[][]): Block => ({
    type: 'table',
    data: { withHeadings: true, stretched: false, content: rows },
});

export const code = (source: string, language: string): Block => ({
    type: 'code',
    data: { code: source, language, showLineNumbers: true, lineNumberStart: 1, wrapLongLines: false, tabSize: 4 },
});

export const image = (url: string, caption: string, alt: string, options: { stretched?: boolean } = {}): Block => ({
    type: 'image',
    data: { url, caption, alt, withBorder: false, withBackground: false, stretched: options.stretched ?? false },
});

export const faq = (...items: Array<[question: string, answer: string]>): Block => ({
    type: 'faq',
    data: { style: 'accordion', items: items.map(([question, answer]) => ({ question, answer })) },
});

export const steps = (...items: Array<[title: string, content: string]>): Block => ({
    type: 'steps',
    data: { items: items.map(([title, content]) => ({ title, content })) },
});

type GalleryLayout = 'grid-balanced' | 'grid-featured' | 'masonry' | 'filmstrip' | 'mosaic';

/** A media gallery of Unsplash photos: `[photo id, caption, alt text]` per item. */
export const gallery = (
    layout: GalleryLayout,
    title: string,
    caption: string,
    items: Array<[id: string, caption: string, altText: string]>,
): Block => ({
    type: 'mediaGallery',
    data: {
        title,
        caption,
        layout,
        items: items.map(([id, itemCaption, altText]) => ({
            url: unsplash(id, 1600),
            thumbnailUrl: unsplash(id, 800),
            caption: itemCaption,
            altText,
            mediaKind: 'image',
            title: '',
        })),
    },
});

/** A photo-journal frame from Unsplash, sized for the lightbox, the page and the timeline collage. */
export const frame = (
    id: string,
    [width, height]: [number, number],
    takenAt: string,
    caption: string,
    alt: string,
    location: string,
): PhotoJournalItem => ({
    id,
    url: unsplash(id, 2400),
    previewUrl: unsplash(id, 1400),
    thumbnailUrl: unsplash(id, 720),
    caption,
    alt,
    location,
    takenAt: Date.parse(takenAt),
    width,
    height,
});
