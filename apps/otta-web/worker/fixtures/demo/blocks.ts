/**
 * Small builders for the Editor.js blocks the demo posts are written in. Every block matches the
 * shape OttaEditor writes and OttaRenderer reads, so seeded posts open in the editor unchanged.
 */
import type { EditorJSData } from '@ottabase/ottablog';
import { unsplash, type DemoImage } from './images';

type Block = { type: string; data: Record<string, unknown> };

export const h2 = (text: string): Block => ({ type: 'header', data: { text, level: 2 } });
export const h3 = (text: string): Block => ({ type: 'header', data: { text, level: 3 } });
export const p = (text: string): Block => ({ type: 'paragraph', data: { text } });
export const quote = (text: string, caption = ''): Block => ({
    type: 'quote',
    data: { text, caption, alignment: 'left' },
});
export const delimiter = (): Block => ({ type: 'delimiter', data: {} });
export const warning = (title: string, message: string): Block => ({ type: 'warning', data: { title, message } });

const listItems = (items: readonly string[]) => items.map((content) => ({ content, items: [] }));
export const ul = (items: readonly string[]): Block => ({
    type: 'list',
    data: { style: 'unordered', items: listItems(items) },
});
export const ol = (items: readonly string[]): Block => ({
    type: 'list',
    data: { style: 'ordered', items: listItems(items) },
});

export const checklist = (items: ReadonlyArray<[text: string, checked: boolean]>): Block => ({
    type: 'checklist',
    data: { items: items.map(([text, checked]) => ({ text, checked })) },
});

export const code = (source: string, language = 'typescript'): Block => ({
    type: 'code',
    data: {
        code: source,
        language,
        showLineNumbers: true,
        lineNumberStart: 1,
        maxHeight: '420px',
        wrapLongLines: false,
        hideHeader: false,
        hideCopyButton: false,
        highlightLines: '',
        tabSize: 4,
        collapsible: false,
        collapsibleThreshold: 20,
    },
});

export const table = (rows: ReadonlyArray<readonly string[]>): Block => ({
    type: 'table',
    data: { withHeadings: true, stretched: false, content: rows.map((row) => [...row]) },
});

export const steps = (items: ReadonlyArray<[title: string, content: string]>): Block => ({
    type: 'steps',
    data: { items: items.map(([title, content]) => ({ title, content })) },
});

export const faq = (items: ReadonlyArray<[question: string, answer: string]>): Block => ({
    type: 'faq',
    data: { style: 'accordion', items: items.map(([question, answer]) => ({ question, answer })) },
});

export const image = (photo: DemoImage, caption?: string): Block => ({
    type: 'advancedImage',
    data: {
        url: unsplash(photo),
        alt: photo.alt,
        caption: caption ?? photo.caption ?? '',
        width: photo.width,
        height: photo.height,
        withBorder: false,
        withBackground: false,
        stretched: false,
    },
});

export const gallery = (title: string, caption: string, photos: readonly DemoImage[], layout = 'grid'): Block => ({
    type: 'mediaGallery',
    data: {
        title,
        caption,
        layout,
        items: photos.map((photo) => ({
            url: unsplash(photo, 1200),
            altText: photo.alt,
            caption: photo.caption ?? '',
            mediaKind: 'image',
            title: photo.title,
        })),
    },
});

export const cta = (text: string, url: string): Block => ({
    type: 'cta',
    data: { text, url, style: 'secondary', alignment: 'center', openInNewTab: false, icon: '' },
});

/** The Editor.js document for one post, with stable block ids so the editor never has to invent them */
export const doc = (slug: string, blocks: readonly Block[]): EditorJSData => ({
    version: '2.31.0',
    blocks: blocks.map((block, index) => ({ id: `${slug}-${index + 1}`, ...block })),
});
