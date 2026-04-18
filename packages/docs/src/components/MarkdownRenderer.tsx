import { CodeBlock } from '@ottabase/ui-code-highlight';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocsCodeRenderMode, TocItem } from '../types';
import { extractToc } from '../utils';

interface MarkdownRendererProps {
    content: string;
    className?: string;
    /** Code block rendering: 'simple' (copy + lang) or 'ui-code-highlight' for syntax highlighting */
    codeRenderMode?: DocsCodeRenderMode;
}

/** Extract code blocks from rendered HTML and replace with placeholder divs */
interface CodeBlockData {
    id: string;
    lang: string;
    code: string;
}

/**
 * Lightweight markdown-to-HTML renderer.
 * codeRenderMode 'simple': built-in copy button + lang label.
 * codeRenderMode 'ui-code-highlight': @ottabase/ui-code-highlight for uniformity.
 */
const DEFAULT_CODE_MODE = 'ui-code-highlight';

export const MarkdownRenderer = memo(function MarkdownRenderer({
    content,
    className = '',
    codeRenderMode = DEFAULT_CODE_MODE,
}: MarkdownRendererProps) {
    const { html, codeBlocks } = useMemo(() => renderMarkdownWithBlocks(content), [content]);
    const mode = codeRenderMode ?? DEFAULT_CODE_MODE;
    const useCodeBlocks = mode === 'simple' || mode === 'ui-code-highlight';

    // Intercept clicks on hash links so TanStack Router doesn't treat them as route navigations
    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = (e.target as HTMLElement).closest('a');
        if (!target) return;
        const href = target.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            const el = document.getElementById(href.slice(1));
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    if (!useCodeBlocks || codeBlocks.length === 0) {
        return (
            <div
                className={`otta-docs-content ${className}`}
                dangerouslySetInnerHTML={{ __html: html }}
                onClick={handleClick}
            />
        );
    }

    return (
        <div className={`otta-docs-content ${className}`} onClick={handleClick}>
            <MarkdownWithCodeBlocks html={html} codeBlocks={codeBlocks} codeRenderMode={mode} />
        </div>
    );
});

/** Render HTML sections interspersed with code block components */
function MarkdownWithCodeBlocks({
    html,
    codeBlocks,
    codeRenderMode,
}: {
    html: string;
    codeBlocks: CodeBlockData[];
    codeRenderMode: DocsCodeRenderMode;
}) {
    const parts = html.split(/<!--codeblock:(\d+)-->[\s\S]*?<!--\/codeblock-->/);
    return (
        <>
            {parts.map((part, i) => {
                if (i % 2 === 1) {
                    const block = codeBlocks[parseInt(part, 10)];
                    if (block) {
                        return (
                            <CodeBlockRenderer
                                key={block.id}
                                lang={block.lang}
                                code={block.code}
                                codeRenderMode={codeRenderMode}
                            />
                        );
                    }
                }
                if (part) {
                    return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />;
                }
                return null;
            })}
        </>
    );
}

/** Normalize language aliases for consistent display and highlight.js */
function normalizeLang(lang: string): string {
    const aliases: Record<string, string> = {
        ts: 'typescript',
        js: 'javascript',
        sh: 'bash',
        shell: 'bash',
        zsh: 'bash',
    };
    const lower = lang?.toLowerCase();
    return (aliases[lower] ?? lower ?? 'text') || 'text';
}

/** Renders code block based on codeRenderMode */
function CodeBlockRenderer({
    lang,
    code,
    codeRenderMode,
}: {
    lang: string;
    code: string;
    codeRenderMode: DocsCodeRenderMode;
}) {
    const normalizedLang = normalizeLang(lang);
    if (codeRenderMode === 'ui-code-highlight') {
        return <CodeBlock code={code} language={normalizedLang} />;
    }
    return <SimpleCodeBlock lang={normalizedLang} code={code} />;
}

/** Simple code block: copy button + lang label, no syntax highlighting */
function SimpleCodeBlock({ lang, code }: { lang: string; code: string }) {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            timerRef.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard not available */
        }
    }, [code]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <div className="otta-docs-code-block otta-docs-code-enhanced">
            <div className="otta-docs-code-header">
                {lang && lang !== 'text' && <span className="otta-docs-code-lang-label">{lang}</span>}
                <button type="button" className="otta-docs-code-copy" onClick={handleCopy} title="Copy code">
                    {copied ? (
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : (
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    )}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
            </div>
            <pre>
                <code className={`language-${lang || 'text'}`}>{code}</code>
            </pre>
        </div>
    );
}

interface TableOfContentsProps {
    content: string;
    activeId?: string;
    onItemClick?: (id: string) => void;
    className?: string;
}

export const TableOfContents = memo(function TableOfContents({
    content,
    activeId,
    onItemClick,
    className = '',
}: TableOfContentsProps) {
    const toc = useMemo<TocItem[]>(() => extractToc(content), [content]);

    if (toc.length === 0) return null;

    return (
        <nav className={`otta-docs-toc ${className}`}>
            <p className="otta-docs-toc-title">On this page</p>
            <ul className="otta-docs-toc-list">
                {toc.map((item, index) => (
                    <li key={`${item.id}-${index}`} className="otta-docs-toc-item" data-level={item.level}>
                        {/* Use button to prevent router from intercepting #anchor clicks */}
                        <button
                            type="button"
                            className={`otta-docs-toc-link ${activeId === item.id ? 'otta-docs-toc-active' : ''}`}
                            style={{ paddingLeft: `${(item.level - 2) * 12 + 12}px` }}
                            onClick={() => {
                                if (onItemClick) {
                                    onItemClick(item.id);
                                } else {
                                    document
                                        .getElementById(item.id)
                                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }}
                        >
                            {item.text}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
});

// --- Markdown to HTML renderer ---

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInline(text: string): string {
    let result = escapeHtml(text);
    // Images (before links to avoid conflict)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
        if (/^\s*javascript:/i.test(src)) return alt;
        return `<img src="${src}" alt="${alt}" class="otta-docs-img" />`;
    });
    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText: string, href: string) => {
        if (/^\s*javascript:/i.test(href)) return linkText;
        // Hash-only links scroll within the page; external links open a new tab
        const isHash = href.startsWith('#');
        const isExternal = !isHash && /^https?:\/\//i.test(href);
        const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${href}" class="otta-docs-link"${targetAttr}>${linkText}</a>`;
    });
    // Bold + italic
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');
    // Strikethrough
    result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code class="otta-docs-inline-code">$1</code>');
    return result;
}

/** Renders markdown to HTML, extracting code blocks as separate data for React rendering */
function renderMarkdownWithBlocks(md: string): { html: string; codeBlocks: CodeBlockData[] } {
    const lines = md.split('\n');
    const output: string[] = [];
    const codeBlocks: CodeBlockData[] = [];
    const usedIds = new Map<string, number>();
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Empty line
        if (trimmed === '') {
            i++;
            continue;
        }

        // Code block
        if (trimmed.startsWith('```')) {
            const lang = trimmed.slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            const code = codeLines.join('\n');
            const blockId = `cb-${codeBlocks.length}`;
            codeBlocks.push({ id: blockId, lang: lang || 'text', code });
            // Placeholder for enhanced mode; fallback HTML for plain mode
            const escaped = escapeHtml(code);
            const fallbackHtml = `<div class="otta-docs-code-block">${lang ? `<div class="otta-docs-code-lang">${escapeHtml(lang)}</div>` : ''}<pre><code class="language-${escapeHtml(lang || 'text')}">${escaped}</code></pre></div>`;
            output.push(`<!--codeblock:${codeBlocks.length - 1}-->${fallbackHtml}<!--/codeblock-->`);
            continue;
        }

        // Heading
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const text = headingMatch[2].replace(/[*_`\[\]]/g, '').trim();
            let id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, ''); // strip leading/trailing dashes (e.g. from emoji prefixes)
            // Deduplicate IDs for repeated headings
            const count = usedIds.get(id) || 0;
            usedIds.set(id, count + 1);
            if (count > 0) id = `${id}-${count}`;
            output.push(
                `<h${level} id="${id}" class="otta-docs-h${level}">${renderInline(headingMatch[2])}</h${level}>`,
            );
            i++;
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            output.push('<hr class="otta-docs-hr" />');
            i++;
            continue;
        }

        // Blockquote
        if (trimmed.startsWith('> ') || trimmed === '>') {
            const quoteLines: string[] = [];
            while (i < lines.length && (lines[i].trim().startsWith('>') || lines[i].trim() === '>')) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            const inner = renderMarkdownWithBlocks(quoteLines.join('\n'));
            // Reindex inner placeholders to align with the outer codeBlocks array
            const offset = codeBlocks.length;
            const reindexedHtml =
                inner.codeBlocks.length > 0
                    ? inner.html.replace(
                          /<!--codeblock:(\d+)-->/g,
                          (_, idx) => `<!--codeblock:${parseInt(idx, 10) + offset}-->`,
                      )
                    : inner.html;
            output.push(`<blockquote class="otta-docs-blockquote">${reindexedHtml}</blockquote>`);
            // Merge inner code blocks with reindexed IDs
            for (const cb of inner.codeBlocks) {
                codeBlocks.push({ ...cb, id: `cb-${codeBlocks.length}` });
            }
            continue;
        }

        // Table
        if (trimmed.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1]?.trim() || '')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().includes('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            output.push(renderTable(tableLines));
            continue;
        }

        // Unordered list
        if (/^[-*+]\s/.test(trimmed)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
                listItems.push(lines[i].replace(/^\s*[-*+]\s/, '').trim());
                i++;
            }
            output.push(
                `<ul class="otta-docs-ul">${listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`,
            );
            continue;
        }

        // Ordered list
        if (/^\d+\.\s/.test(trimmed)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
                listItems.push(lines[i].replace(/^\s*\d+\.\s/, '').trim());
                i++;
            }
            output.push(
                `<ol class="otta-docs-ol">${listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`,
            );
            continue;
        }

        // Paragraph
        const paraLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !lines[i].trim().startsWith('#') &&
            !lines[i].trim().startsWith('```') &&
            !lines[i].trim().startsWith('> ') &&
            !/^[-*_]{3,}$/.test(lines[i].trim())
        ) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            output.push(`<p class="otta-docs-p">${renderInline(paraLines.join(' '))}</p>`);
        }
    }

    return { html: output.join('\n'), codeBlocks };
}

function renderTable(lines: string[]): string {
    if (lines.length < 2) return '';

    const parseRow = (line: string) =>
        line
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim());

    const headers = parseRow(lines[0]);
    const alignLine = parseRow(lines[1]);
    const aligns = alignLine.map((cell) => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        return 'left';
    });

    const rows = lines.slice(2).map(parseRow);

    const headerHtml = headers
        .map((h, i) => `<th style="text-align:${aligns[i] || 'left'}">${renderInline(h)}</th>`)
        .join('');

    const bodyHtml = rows
        .map(
            (row) =>
                `<tr>${row.map((cell, i) => `<td style="text-align:${aligns[i] || 'left'}">${renderInline(cell)}</td>`).join('')}</tr>`,
        )
        .join('');

    return `<div class="otta-docs-table-wrapper"><table class="otta-docs-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}
