import { useMemo } from 'react';
import type { TocItem } from '../types';
import { extractToc } from '../utils';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Lightweight markdown-to-HTML renderer.
 * Handles: headings, paragraphs, code blocks, inline code, bold, italic,
 * links, images, lists, blockquotes, horizontal rules, and tables.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const html = useMemo(() => renderMarkdown(content), [content]);

    return <div className={`otta-docs-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

interface TableOfContentsProps {
    content: string;
    activeId?: string;
    onItemClick?: (id: string) => void;
    className?: string;
}

export function TableOfContents({ content, activeId, onItemClick, className = '' }: TableOfContentsProps) {
    const toc = useMemo<TocItem[]>(() => extractToc(content), [content]);

    if (toc.length === 0) return null;

    return (
        <nav className={`otta-docs-toc ${className}`}>
            <p className="otta-docs-toc-title">On this page</p>
            <ul className="otta-docs-toc-list">
                {toc.map((item) => (
                    <li key={item.id} className="otta-docs-toc-item" data-level={item.level}>
                        <a
                            href={`#${item.id}`}
                            className={`otta-docs-toc-link ${activeId === item.id ? 'otta-docs-toc-active' : ''}`}
                            style={{ paddingLeft: `${(item.level - 2) * 12 + 8}px` }}
                            onClick={(e) => {
                                if (onItemClick) {
                                    e.preventDefault();
                                    onItemClick(item.id);
                                }
                            }}
                        >
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

// --- Markdown to HTML renderer ---

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInline(text: string): string {
    let result = escapeHtml(text);
    // Images (before links to avoid conflict)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="otta-docs-img" />');
    // Links
    result = result.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="otta-docs-link" target="_blank" rel="noopener noreferrer">$1</a>',
    );
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

function renderMarkdown(md: string): string {
    const lines = md.split('\n');
    const output: string[] = [];
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
            const code = escapeHtml(codeLines.join('\n'));
            output.push(
                `<div class="otta-docs-code-block">${lang ? `<div class="otta-docs-code-lang">${escapeHtml(lang)}</div>` : ''}<pre><code class="language-${escapeHtml(lang || 'text')}">${code}</code></pre></div>`,
            );
            continue;
        }

        // Heading
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const text = headingMatch[2].replace(/[*_`\[\]]/g, '').trim();
            const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-');
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
            output.push(
                `<blockquote class="otta-docs-blockquote">${renderMarkdown(quoteLines.join('\n'))}</blockquote>`,
            );
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

    return output.join('\n');
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
