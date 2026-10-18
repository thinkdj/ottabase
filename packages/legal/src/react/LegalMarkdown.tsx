/**
 * Built-in, dependency-free Markdown to React renderer for legal prose.
 *
 * Supports exactly what the templates use, the same grammar as the server-side renderer in `../html.ts`: `##`/`###`
 * headings with anchor ids matching the TOC, paragraphs, lists, blockquotes, rules, and inline bold, italic, code and
 * links. It renders real React elements, never `dangerouslySetInnerHTML`, so it is XSS-safe by construction, and a link
 * is kept only when its address is relative, an anchor, http(s) or mailto. Pass your own `renderMarkdown` to
 * `LegalDocument` for a fuller renderer.
 */

import { type ReactNode } from 'react';
import { safeHref } from '../html';
import { makeHeadingSlugger } from '../interpolate';

const BLOCK_START = /^(#{2,3}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+|(?:-{3,}|\*{3,}|_{3,})$)/;

/** Inline Markdown (links, bold, italic, code) to React nodes. */
function renderInline(text: string, keyBase: string): ReactNode[] {
    const out: ReactNode[] = [];
    let buffer = '';
    let pos = 0;
    let i = 0;
    const flush = () => {
        if (buffer) {
            out.push(buffer);
            buffer = '';
        }
    };
    while (pos < text.length) {
        const rest = text.slice(pos);
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
        const bold = !link ? /^\*\*([^*]+)\*\*/.exec(rest) : null;
        const ital = !link && !bold ? /^(?:\*([^*\n]+)\*|_([^_\n]+)_)/.exec(rest) : null;
        const code = !link && !bold && !ital ? /^`([^`]+)`/.exec(rest) : null;

        if (link) {
            flush();
            const href = safeHref(link[2]);
            const key = `${keyBase}-${i++}`;
            if (href) {
                const external = /^https?:\/\//i.test(href);
                out.push(
                    <a
                        key={key}
                        className="otta-legal-a"
                        href={href}
                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                        {renderInline(link[1], key)}
                    </a>,
                );
            } else out.push(...renderInline(link[1], key));
            pos += link[0].length;
        } else if (bold) {
            flush();
            const key = `${keyBase}-${i++}`;
            out.push(<strong key={key}>{renderInline(bold[1], key)}</strong>);
            pos += bold[0].length;
        } else if (ital) {
            flush();
            const key = `${keyBase}-${i++}`;
            out.push(<em key={key}>{renderInline(ital[1] ?? ital[2], key)}</em>);
            pos += ital[0].length;
        } else if (code) {
            flush();
            out.push(
                <code key={`${keyBase}-${i++}`} className="otta-legal-code">
                    {code[1]}
                </code>,
            );
            pos += code[0].length;
        } else {
            buffer += text[pos];
            pos += 1;
        }
    }
    flush();
    return out;
}

/** A paragraph's lines: two trailing spaces end a line, as in an address. */
function renderParagraph(lines: string[], keyBase: string): ReactNode[] {
    const out: ReactNode[] = [];
    lines.forEach((l, idx) => {
        const hard = / {2}$/.test(l);
        out.push(...renderInline(hard ? l.trimEnd() : l.trim(), `${keyBase}-${idx}`));
        if (idx < lines.length - 1) out.push(hard ? <br key={`${keyBase}-br-${idx}`} /> : ' ');
    });
    return out;
}

/** Parse Markdown into block-level React elements. */
function renderBlocks(markdown: string): ReactNode[] {
    const slug = makeHeadingSlugger();
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: ReactNode[] = [];
    let k = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            i += 1;
            continue;
        }

        const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
        if (heading) {
            const level = heading[1].length;
            const text = heading[2];
            const id = slug(text.replace(/[`*_]/g, '').trim());
            const inline = renderInline(text, `h-${k}`);
            blocks.push(
                level === 2 ? (
                    <h2 key={k} id={id} className="otta-legal-h2">
                        {inline}
                    </h2>
                ) : (
                    <h3 key={k} id={id} className="otta-legal-h3">
                        {inline}
                    </h3>
                ),
            );
            k += 1;
            i += 1;
            continue;
        }

        if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            blocks.push(<hr key={k} className="otta-legal-hr" />);
            k += 1;
            i += 1;
            continue;
        }

        if (/^>\s?/.test(line)) {
            const quote: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
            blocks.push(
                <blockquote key={k} className="otta-legal-blockquote">
                    {renderInline(quote.join(' '), `bq-${k}`)}
                </blockquote>,
            );
            k += 1;
            continue;
        }

        const list = /^\s*[-*]\s+/.test(line) ? 'ul' : /^\s*\d+\.\s+/.test(line) ? 'ol' : null;
        if (list) {
            const re = list === 'ul' ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/;
            const items: string[] = [];
            while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
            const children = items.map((it, idx) => <li key={idx}>{renderInline(it, `li-${k}-${idx}`)}</li>);
            blocks.push(
                list === 'ul' ? (
                    <ul key={k} className="otta-legal-ul">
                        {children}
                    </ul>
                ) : (
                    <ol key={k} className="otta-legal-ol">
                        {children}
                    </ol>
                ),
            );
            k += 1;
            continue;
        }

        const para: string[] = [];
        while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) para.push(lines[i++]);
        blocks.push(
            <p key={k} className="otta-legal-p">
                {renderParagraph(para, `p-${k}`)}
            </p>,
        );
        k += 1;
    }

    return blocks;
}

export interface LegalMarkdownProps {
    markdown: string;
    className?: string;
}

/** Render an assembled legal document's Markdown to React. */
export function LegalMarkdown({ markdown, className }: LegalMarkdownProps) {
    return <div className={['otta-legal-content', className].filter(Boolean).join(' ')}>{renderBlocks(markdown)}</div>;
}
