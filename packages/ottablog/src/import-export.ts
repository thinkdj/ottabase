/**
 * Blog import/export — the portable file format plus a Markdown reader.
 *
 * One wire shape (`BlogExportPost`) travels both ways: `GET /api/blog/export` writes it and
 * `POST /api/blog/import` reads it. Markdown files are converted into the same shape client-side,
 * so the server has exactly one import contract to validate. Taxonomy travels by NAME (not id), so
 * a file moves between apps, organizations, and databases.
 *
 * Pure module: no DB, no React. Safe for the browser and the Worker.
 */
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { escapeHtml } from './seo';
import {
    POST_STATUSES,
    type ContentType,
    type EditorJSData,
    type HeroImage,
    type PostStatus,
    type SeoMeta,
} from './types';

export const BLOG_EXPORT_FORMAT = 'ottablog';
export const BLOG_EXPORT_VERSION = 1;
/**
 * Posts per `POST /api/blog/import` request. Each post costs several D1 queries (slug check,
 * insert, taxonomy lookups, links), so a request stays far below the per-invocation query cap.
 */
export const BLOG_IMPORT_BATCH_SIZE = 10;

/** One post in an export/import file. Everything but `title`/`slug` is optional on import. */
export interface BlogExportPost {
    title: string;
    slug?: string;
    language?: string;
    contentType?: ContentType;
    status?: PostStatus;
    excerpt?: string | null;
    content?: EditorJSData | null;
    blurbText?: string | null;
    photoNote?: string | null;
    photoAlbum?: unknown[] | null;
    crossposts?: unknown[] | null;
    heroImage?: HeroImage | null;
    seoMeta?: SeoMeta | null;
    originalDate?: unknown;
    meta?: Record<string, unknown> | null;
    footnotes?: EditorJSData | null;
    privateNotes?: EditorJSData | null;
    isFeatured?: boolean;
    allowComments?: boolean;
    /** Exported for information only — a password never leaves the server, so import drops protection. */
    isProtected?: boolean;
    publishAt?: number | null;
    publishedAt?: number | null;
    seriesOrder?: number | null;
    /** Tag names. */
    tags?: string[];
    /** Category names (flat — hierarchy is not carried). */
    categories?: string[];
    /** Series title. */
    series?: string | null;
}

export interface BlogExportFile {
    format: typeof BLOG_EXPORT_FORMAT;
    version: typeof BLOG_EXPORT_VERSION;
    exportedAt: string;
    posts: BlogExportPost[];
}

/** Per-request result of `POST /api/blog/import`. */
export interface BlogImportResult {
    created: Array<{ slug: string; id: string }>;
    skipped: Array<{ slug: string; reason: string }>;
    warnings: Array<{ slug: string; message: string }>;
}

/**
 * Read one user-supplied file into importable posts: an ottablog JSON export, or a single
 * Markdown post with optional YAML front matter. Throws an Error with a readable message.
 */
export function readBlogImportFile(text: string, fileName: string): BlogExportPost[] {
    if (/\.json$/i.test(fileName)) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error(`${fileName}: not valid JSON`);
        }
        const file = parsed as Partial<BlogExportFile> | null;
        if (!file || file.format !== BLOG_EXPORT_FORMAT || !Array.isArray(file.posts)) {
            throw new Error(`${fileName}: not an ottablog export file`);
        }
        if (file.version !== BLOG_EXPORT_VERSION) {
            throw new Error(`${fileName}: unsupported export version ${String(file.version)}`);
        }
        return file.posts;
    }
    if (/\.(md|markdown)$/i.test(fileName)) return [parseMarkdownPost(text, fileName)];
    throw new Error(`${fileName}: only .json exports and .md files can be imported`);
}

// ============================================================
// Markdown post (front matter + body)
// ============================================================

const STATUSES = new Set<string>(Object.keys(POST_STATUSES));
// Filenames that name a folder's page rather than the post (Hugo/Astro bundles, READMEs).
const NON_SLUG_FILENAMES = new Set(['index', '_index', 'readme']);

/**
 * Convert a Markdown file (Jekyll / Hugo / Astro / Eleventy / Ghost-export style) into an
 * importable post. Front matter keys are matched case-insensitively against the common aliases.
 * A post is `published` unless it says otherwise (`draft: true`, `published: false`, `status:`).
 */
export function parseMarkdownPost(source: string, fileName = ''): BlogExportPost {
    const { data, body } = parseFrontMatter(source);
    const baseName = fileName
        .replace(/^.*[\\/]/, '')
        .replace(/\.(md|markdown)$/i, '')
        .toLowerCase();
    // Jekyll: _posts/2020-01-31-my-post.md
    const jekyll = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(baseName);
    const fileSlug = jekyll ? jekyll[2] : NON_SLUG_FILENAMES.has(baseName) ? '' : baseName;

    let markdown = body;
    let title = stringValue(data.title);
    if (!title) {
        // No title in front matter: a leading `# Heading` is the title, not body content.
        const h1 = /^\s*#\s+(.+?)(?:\s+#+)?\s*(?:\r?\n|$)/.exec(markdown);
        if (h1) {
            title = h1[1];
            markdown = markdown.slice(h1[0].length);
        }
    }
    if (!title) title = fileSlug.replace(/[-_]+/g, ' ').trim();

    const dateText = stringValue(
        data.date ?? data.pubdate ?? data.publishdate ?? data.publish_date ?? data.published_at ?? jekyll?.[1],
    );
    // Jekyll uses `published: false` as a draft flag; Eleventy-style setups use it as a date.
    const publishedFlag = data.published;
    const parsedDate = dateText
        ? Date.parse(dateText)
        : typeof publishedFlag === 'string'
          ? Date.parse(publishedFlag)
          : NaN;
    const explicitStatus = stringValue(data.status)?.toLowerCase();
    const status: PostStatus =
        explicitStatus && STATUSES.has(explicitStatus)
            ? (explicitStatus as PostStatus)
            : data.draft === true || publishedFlag === false
              ? 'draft'
              : 'published';

    const cover = stringValue(
        data.cover_image ?? data.image ?? data.cover ?? data.hero ?? data.feature_image ?? data.featured_image,
    );
    const series = listValue(data.series)[0] ?? null;

    return {
        title,
        slug: stringValue(data.slug) || fileSlug || undefined,
        language: stringValue(data.lang ?? data.language) || undefined,
        contentType: 'blog',
        status,
        excerpt: stringValue(data.description ?? data.excerpt ?? data.summary ?? data.subtitle) || null,
        content: markdownToEditorJs(markdown),
        heroImage: cover ? { url: cover, alt: title } : null,
        publishedAt: Number.isFinite(parsedDate) ? parsedDate : null,
        tags: listValue(data.tags ?? data.tag ?? data.keywords),
        categories: listValue(data.categories ?? data.category),
        series,
    };
}

type FrontMatterValue = string | boolean | string[];

/**
 * The YAML subset blog front matter actually uses: `key: value`, quoted strings, booleans,
 * `[a, b]` inline lists, and `- item` block lists. Nested maps are ignored.
 */
function parseFrontMatter(source: string): { data: Record<string, FrontMatterValue>; body: string } {
    const match = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
    if (!match) return { data: {}, body: source };

    const data: Record<string, FrontMatterValue> = {};
    let listKey: string | null = null;
    for (const line of match[1].split(/\r?\n/)) {
        const item = /^\s*-\s+(.*)$/.exec(line);
        if (item && listKey) {
            (data[listKey] as string[]).push(String(scalar(item[1])));
            continue;
        }
        const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (!pair) continue;
        const key = pair[1].toLowerCase();
        const raw = pair[2].trim();
        listKey = null;
        if (raw === '') {
            data[key] = [];
            listKey = key;
        } else if (raw.startsWith('[') && raw.endsWith(']')) {
            data[key] = raw
                .slice(1, -1)
                .split(',')
                .map((part) => String(scalar(part)))
                .filter(Boolean);
        } else {
            data[key] = scalar(raw);
        }
    }
    return { data, body: source.slice(match[0].length) };
}

function scalar(raw: string): string | boolean {
    const value = raw.replace(/\s+#.*$/, '').trim();
    if (value === 'true') return true;
    if (value === 'false') return false;
    const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
    return quoted ? quoted[2] : value;
}

function stringValue(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
    return '';
}

function listValue(value: unknown): string[] {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return items.map((item) => String(item).trim()).filter(Boolean);
}

// ============================================================
// Markdown body → EditorJS blocks
// ============================================================

type Block = EditorJSData['blocks'][number];
interface ListItem {
    content: string;
    items: ListItem[];
}

const FENCE = /^\s*(```+|~~~+)\s*([\w+#.-]*)/;
// A closing `#` run needs a space before it, so `Learn C#` keeps its `#`.
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
// A URL may contain one level of balanced parentheses: https://en.wikipedia.org/wiki/Foo_(bar)
const URL_PART = String.raw`((?:[^()\s<>]|\([^()\s]*\))+)`;
const IMAGE_LINE = new RegExp(String.raw`^\s*!\[([^\]]*)\]\(\s*<?${URL_PART}>?(?:\s+"([^"]*)")?\s*\)\s*$`);
const INLINE_LINK = new RegExp(String.raw`!?\[([^\]]+)\]\(\s*<?${URL_PART}>?(?:\s+"[^"]*")?\s*\)`, 'g');

/**
 * Convert CommonMark-style Markdown into the EditorJS blocks OttaEditor and the renderer use:
 * paragraph, header, list (nested), code, quote, delimiter, image. Inline bold/italic/code/links
 * become the inline HTML EditorJS stores. Raw HTML is escaped (shown as text), never executed.
 * Not covered: tables, setext headings, indented code blocks, footnotes — they import as text.
 */
export function markdownToEditorJs(markdown: string): EditorJSData {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const blocks: Block[] = [];
    let paragraph: string[] = [];

    const flushParagraph = () => {
        if (paragraph.length) blocks.push({ type: 'paragraph', data: { text: inlineMarkdown(paragraph.join(' ')) } });
        paragraph = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!line.trim()) {
            flushParagraph();
            continue;
        }

        const fence = FENCE.exec(line);
        if (fence) {
            flushParagraph();
            const code: string[] = [];
            while (++i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i]);
            blocks.push({ type: 'code', data: { code: code.join('\n'), language: fence[2] || 'plaintext' } });
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading) {
            flushParagraph();
            blocks.push({ type: 'header', data: { text: inlineMarkdown(heading[2]), level: heading[1].length } });
            continue;
        }

        if (RULE.test(line)) {
            flushParagraph();
            blocks.push({ type: 'delimiter', data: {} });
            continue;
        }

        const image = IMAGE_LINE.exec(line);
        if (image) {
            flushParagraph();
            const url = sanitizeUrl(image[2]);
            if (url !== '#') blocks.push({ type: 'image', data: { url, alt: image[1], caption: image[3] ?? '' } });
            continue;
        }

        if (QUOTE.test(line)) {
            flushParagraph();
            const quoted: string[] = [];
            for (; i < lines.length && QUOTE.test(lines[i]); i++) quoted.push(QUOTE.exec(lines[i])![1]);
            i--;
            blocks.push({ type: 'quote', data: { text: inlineMarkdown(quoted.join(' ').trim()), caption: '' } });
            continue;
        }

        const first = LIST_ITEM.exec(line);
        if (first) {
            flushParagraph();
            const entries: Array<{ indent: number; text: string }> = [];
            for (; i < lines.length; i++) {
                const current = lines[i];
                const item = LIST_ITEM.exec(current);
                if (item) {
                    entries.push({ indent: item[1].replace(/\t/g, '    ').length, text: item[3] });
                } else if (current.trim() && /^\s+/.test(current)) {
                    // Indented continuation line of the previous item.
                    entries[entries.length - 1].text += ` ${current.trim()}`;
                } else if (!current.trim() && LIST_ITEM.test(lines[i + 1] ?? '')) {
                    // Loose list: a blank line between items does not end the list.
                } else {
                    break;
                }
            }
            i--;
            blocks.push({
                type: 'list',
                data: { style: /\d/.test(first[2]) ? 'ordered' : 'unordered', items: nestListItems(entries) },
            });
            continue;
        }

        paragraph.push(line.trim());
    }
    flushParagraph();

    return { time: Date.now(), blocks };
}

/** Indentation → nesting. An item belongs to the nearest preceding item indented less than it. */
function nestListItems(entries: Array<{ indent: number; text: string }>): ListItem[] {
    const root: ListItem[] = [];
    const stack: Array<{ indent: number; items: ListItem[] }> = [{ indent: -1, items: root }];
    for (const entry of entries) {
        while (stack.length > 1 && entry.indent <= stack[stack.length - 1].indent) stack.pop();
        const item: ListItem = { content: inlineMarkdown(entry.text), items: [] };
        stack[stack.length - 1].items.push(item);
        stack.push({ indent: entry.indent, items: item.items });
    }
    return root;
}

/**
 * Inline Markdown → the inline HTML EditorJS stores. Code spans and link tags are stashed behind
 * placeholders, everything else is HTML-escaped, so the only tags in the output are the ones
 * produced here and emphasis markers inside code or URLs (`snake_case`, `a*b`) stay literal.
 * `_`/`__` only open at a word boundary, as in CommonMark, so `snake_case_name` survives as text.
 */
export function inlineMarkdown(text: string): string {
    const stash: string[] = [];
    const hold = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;

    const marked = text
        .replace(/\u0000/g, '')
        .replace(/`([^`]+)`/g, (_, code: string) => hold(`<code>${escapeHtml(code)}</code>`))
        .replace(INLINE_LINK, (_, label: string, href: string) => {
            const url = sanitizeUrl(href);
            return url === '#' ? label : `${hold(`<a href="${escapeHtml(url)}">`)}${label}${hold('</a>')}`;
        });

    return escapeHtml(marked)
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>')
        .replace(/(^|\W)__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<b>$2</b>')
        .replace(/\*(?=\S)([^*]*?\S)\*/g, '<i>$1</i>')
        .replace(/(^|\W)_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<i>$2</i>')
        .replace(/\u0000(\d+)\u0000/g, (_, n: string) => stash[Number(n)]);
}
