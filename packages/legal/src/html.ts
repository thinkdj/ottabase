/**
 * Server-side rendering: the assembled Markdown to HTML, and a complete standalone page. Dependency-free and safe by
 * construction: every piece of text is escaped, and a link is kept only when its address is relative, an anchor,
 * http(s) or mailto. The grammar is exactly what the templates use, the same one the React renderer understands:
 * `##`/`###` headings with anchor ids matching the TOC, paragraphs, lists, blockquotes, rules, and inline bold, italic,
 * code and links.
 */

import { assembleLegalDocument, listLegalDocuments } from './assemble';
import { legalBaseOf, makeHeadingSlugger } from './interpolate';
import type { AssembledLegalDocument, LegalConfig, LegalDocMeta } from './types';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESC[ch]);

/** A link address the page may carry: relative, an anchor, http(s) or mailto. Anything else is dropped. */
export const safeHref = (href: string): string | null =>
    /^(\/(?!\/)|#|https?:\/\/|mailto:)/i.test(href.trim()) ? href.trim() : null;

/** Inline Markdown (links, bold, italic, code) to escaped HTML. */
export function inlineToHtml(text: string): string {
    let out = '';
    let pos = 0;
    while (pos < text.length) {
        const rest = text.slice(pos);
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
        const bold = !link ? /^\*\*([^*]+)\*\*/.exec(rest) : null;
        const ital = !link && !bold ? /^(?:\*([^*\n]+)\*|_([^_\n]+)_)/.exec(rest) : null;
        const code = !link && !bold && !ital ? /^`([^`]+)`/.exec(rest) : null;
        if (link) {
            const href = safeHref(link[2]);
            const label = inlineToHtml(link[1]);
            if (href) {
                const external = /^https?:\/\//i.test(href);
                out += `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
            } else out += label;
            pos += link[0].length;
        } else if (bold) {
            out += `<strong>${inlineToHtml(bold[1])}</strong>`;
            pos += bold[0].length;
        } else if (ital) {
            out += `<em>${inlineToHtml(ital[1] ?? ital[2])}</em>`;
            pos += ital[0].length;
        } else if (code) {
            out += `<code>${escapeHtml(code[1])}</code>`;
            pos += code[0].length;
        } else {
            // Escape one character at a time so a `<` in prose can never open a tag.
            out += escapeHtml(text[pos]);
            pos += 1;
        }
    }
    return out;
}

const BLOCK_START = /^(#{2,3}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+|(?:-{3,}|\*{3,}|_{3,})$)/;

/** Block-level Markdown to HTML. Heading ids come from the same slugger as the TOC. */
export function markdownToHtml(markdown: string): string {
    const slug = makeHeadingSlugger();
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            i += 1;
            continue;
        }
        const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
        if (heading) {
            const tag = heading[1].length === 2 ? 'h2' : 'h3';
            const id = slug(heading[2].replace(/[`*_]/g, '').trim());
            out.push(`<${tag} id="${escapeHtml(id)}">${inlineToHtml(heading[2])}</${tag}>`);
            i += 1;
            continue;
        }
        if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            out.push('<hr>');
            i += 1;
            continue;
        }
        if (/^>\s?/.test(line)) {
            const quote: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
            out.push(`<blockquote>${inlineToHtml(quote.join(' '))}</blockquote>`);
            continue;
        }
        const list = /^\s*[-*]\s+/.test(line) ? 'ul' : /^\s*\d+\.\s+/.test(line) ? 'ol' : null;
        if (list) {
            const re = list === 'ul' ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/;
            const items: string[] = [];
            while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
            out.push(`<${list}>${items.map((it) => `<li>${inlineToHtml(it)}</li>`).join('')}</${list}>`);
            continue;
        }
        // A paragraph: consecutive lines that do not start a block. Two trailing spaces end a line (an address).
        const para: string[] = [];
        while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) para.push(lines[i++]);
        out.push(
            `<p>${para.map((l) => (/ {2}$/.test(l) ? `${inlineToHtml(l.trimEnd())}<br>` : inlineToHtml(l.trim()))).join(' ')}</p>`,
        );
    }
    return out.join('\n');
}

/** The HTML for one document's article: title, date, table of contents, body and copyright. */
export function documentToHtml(doc: AssembledLegalDocument): string {
    const toc = doc.toc.filter((t) => t.level === 2);
    return [
        '<article class="otta-legal">',
        `<h1 class="otta-legal-title">${escapeHtml(doc.title)}</h1>`,
        doc.lastUpdated ? `<p class="otta-legal-meta">Last updated ${escapeHtml(doc.lastUpdated)}</p>` : '',
        toc.length > 1
            ? `<nav class="otta-legal-toc" aria-label="On this page"><p class="otta-legal-toc-title">On this page</p><ol>${toc
                  .map((t) => `<li><a href="#${escapeHtml(t.id)}">${escapeHtml(t.text)}</a></li>`)
                  .join('')}</ol></nav>`
            : '',
        `<div class="otta-legal-content">${markdownToHtml(doc.markdown)}</div>`,
        `<footer class="otta-legal-footer"><p>${escapeHtml(doc.copyright)}</p></footer>`,
        '</article>',
    ]
        .filter(Boolean)
        .join('\n');
}

/** The HTML for the index: every published document as a link. */
export function indexToHtml(config: LegalConfig, docs: LegalDocMeta[] = listLegalDocuments(config)): string {
    const base = legalBaseOf(config);
    return [
        '<div class="otta-legal otta-legal-index">',
        `<h1 class="otta-legal-title">Legal</h1>`,
        `<p class="otta-legal-meta">The policies that govern ${escapeHtml(config.appName)}.</p>`,
        ...docs.map(
            (d) =>
                `<a class="otta-legal-index-item" href="${escapeHtml(`${base}/${d.slug}`)}"><h3>${escapeHtml(d.title)}</h3></a>`,
        ),
        '</div>',
    ].join('\n');
}

/** The page styles, the same tokens as styles.css, reading the app's CSS variables when the page has them. */
export const PAGE_STYLE = [
    ':root{color-scheme:light dark}',
    'body{margin:0;background:hsl(var(--background,0 0% 100%));font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}',
    '.otta-legal{--otta-legal-fg:hsl(var(--foreground,222 47% 11%));--otta-legal-muted:hsl(var(--muted-foreground,215 16% 47%));--otta-legal-primary:hsl(var(--primary,222 47% 11%));--otta-legal-border:hsl(var(--border,214 32% 91%));--otta-legal-surface:hsl(var(--muted,210 40% 96%));color:var(--otta-legal-fg);margin:0 auto;max-width:48rem;padding:3.5rem 1.5rem 5rem;font-size:.9375rem;line-height:1.7}',
    '@media(prefers-color-scheme:dark){body{background:hsl(var(--background,222 47% 7%))}.otta-legal{--otta-legal-fg:hsl(var(--foreground,210 40% 96%));--otta-legal-muted:hsl(var(--muted-foreground,215 20% 65%));--otta-legal-primary:hsl(var(--primary,210 40% 96%));--otta-legal-border:hsl(var(--border,217 33% 20%));--otta-legal-surface:hsl(var(--muted,217 33% 14%))}}',
    '.otta-legal-nav{display:flex;flex-wrap:wrap;gap:.25rem 1rem;margin:0 0 2.5rem;font-size:.8125rem}.otta-legal-nav a{color:var(--otta-legal-muted);text-decoration:none}.otta-legal-nav a[aria-current]{color:var(--otta-legal-fg);font-weight:600}',
    '.otta-legal-title{margin:0 0 .25rem;font-size:1.875rem;font-weight:700;letter-spacing:-.02em}.otta-legal-meta{margin:0 0 2rem;font-size:.8125rem;color:var(--otta-legal-muted)}',
    '.otta-legal-toc{margin:0 0 2.5rem;padding:1rem 1.25rem;border:1px solid var(--otta-legal-border);border-radius:.75rem;background:var(--otta-legal-surface)}.otta-legal-toc-title{margin:0 0 .5rem;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--otta-legal-muted)}.otta-legal-toc ol{margin:0;padding-left:1.1rem;columns:2;column-gap:2rem}.otta-legal-toc li{margin:.15rem 0;break-inside:avoid}.otta-legal-toc a{color:inherit;text-decoration:none}.otta-legal-toc a:hover{text-decoration:underline}',
    '.otta-legal-content h2{margin:2.25rem 0 .75rem;font-size:1.25rem;font-weight:650;letter-spacing:-.01em}.otta-legal-content h3{margin:1.5rem 0 .5rem;font-size:1.0625rem;font-weight:600}.otta-legal-content p,.otta-legal-content li{margin:.6rem 0}.otta-legal-content ul,.otta-legal-content ol{padding-left:1.4rem}.otta-legal-content a{color:var(--otta-legal-primary);text-decoration:underline;text-underline-offset:2px}.otta-legal-content blockquote{margin:1rem 0;padding:.25rem 0 .25rem 1rem;border-left:3px solid var(--otta-legal-border);color:var(--otta-legal-muted)}.otta-legal-content hr{border:0;border-top:1px solid var(--otta-legal-border);margin:2rem 0}.otta-legal-content code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.875em;padding:.1em .35em;border-radius:.3rem;background:var(--otta-legal-surface)}',
    '.otta-legal-footer{margin-top:3.5rem;padding-top:1.25rem;border-top:1px solid var(--otta-legal-border);font-size:.8125rem;color:var(--otta-legal-muted)}',
    '.otta-legal-index-item{display:block;margin:0 0 .75rem;padding:1rem 1.25rem;border:1px solid var(--otta-legal-border);border-radius:.75rem;color:inherit;text-decoration:none}.otta-legal-index-item:hover{background:var(--otta-legal-surface)}.otta-legal-index-item h3{margin:0;font-size:1rem;font-weight:600}',
    '@media(max-width:640px){.otta-legal{padding:2.5rem 1.25rem 4rem}.otta-legal-toc ol{columns:1}}',
].join('');

/** A complete HTML page for one document, or for the index when `doc` is omitted, with the nav of every published
 *  document. */
export function pageToHtml(config: LegalConfig, doc?: AssembledLegalDocument): string {
    const docs = listLegalDocuments(config);
    const base = legalBaseOf(config);
    const title = doc ? `${doc.title} · ${config.appName}` : `Legal · ${config.appName}`;
    const nav = `<nav class="otta-legal otta-legal-nav" aria-label="Legal documents" style="padding-bottom:0"><a href="${escapeHtml(base || '/')}"${doc ? '' : ' aria-current="page"'}>Legal</a>${docs
        .map(
            (d) =>
                `<a href="${escapeHtml(`${base}/${d.slug}`)}"${doc?.id === d.id ? ' aria-current="page"' : ''}>${escapeHtml(d.title)}</a>`,
        )
        .join('')}</nav>`;
    return (
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(doc ? `${doc.title} for ${config.appName}.` : `The policies that govern ${config.appName}.`)}">` +
        `<link rel="canonical" href="${escapeHtml(`${config.siteUrl.replace(/\/+$/, '')}${base}${doc ? `/${doc.slug}` : ''}`)}">` +
        `<style>${PAGE_STYLE}</style></head><body>${nav}${doc ? documentToHtml(doc) : indexToHtml(config, docs)}</body></html>`
    );
}

/** One document as a Markdown file: title, date and body. */
export function documentToMarkdown(doc: AssembledLegalDocument): string {
    return [
        `# ${doc.title}`,
        doc.lastUpdated ? `_Last updated ${doc.lastUpdated}_` : '',
        doc.markdown,
        '---',
        doc.copyright,
    ]
        .filter(Boolean)
        .join('\n\n');
}

/** Convenience: assemble and render one document to a full page. */
export const renderLegalPage = (config: LegalConfig, docId: AssembledLegalDocument['id']): string =>
    pageToHtml(config, assembleLegalDocument(docId, config));
