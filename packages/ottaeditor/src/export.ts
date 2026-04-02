import type { OutputData } from '@editorjs/editorjs';

/**
 * Pretty-prints EditorJS OutputData as formatted JSON string
 */
export function exportToJSON(data: OutputData): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Converts basic inline HTML to Markdown equivalents.
 * Handles bold, italic, links, code, mark, underline, and strips unknown tags.
 */
export function convertInlineHTML(html: string): string {
    if (!html) return '';

    let md = html;

    // Convert links: <a href="url">text</a>
    md = md.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs: string, text: string) => {
        const hrefMatch = attrs.match(/href="([^"]*)"/);
        const href = hrefMatch ? hrefMatch[1] : '';
        return `[${text}](${href})`;
    });

    // Convert bold: <b> or <strong>
    md = md.replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**');

    // Convert italic: <i> or <em>
    md = md.replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*');

    // Convert inline code: <code>
    md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

    // Convert mark/highlight: <mark>
    md = md.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==');

    // Keep underline as HTML (markdown has no native underline)
    // <u>text</u> stays as-is

    // Strip <br> tags → newline
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Strip all remaining HTML tags except <u> (negative lookahead keeps underline as-is)
    // Loop to handle any residual partial tags from nested stripping
    let prev;
    do {
        prev = md;
        md = md.replace(/<(?!\/?u>)[^>]+>/g, '');
    } while (md !== prev);

    return md;
}

/**
 * Converts a single EditorJS block to Markdown
 */
function blockToMarkdown(block: { type: string; data: Record<string, any> }): string {
    const { type, data } = block;

    switch (type) {
        case 'paragraph':
            return convertInlineHTML(data.text || '');

        case 'header': {
            const level = Math.min(Math.max(data.level || 1, 1), 6);
            const hashes = '#'.repeat(level);
            return `${hashes} ${convertInlineHTML(data.text || '')}`;
        }

        case 'list':
        case 'nestedList':
            return renderListItems(data.items || [], data.style || 'unordered', 0);

        case 'checklist':
            return (data.items || [])
                .map((item: { text: string; checked: boolean }) => {
                    const checkbox = item.checked ? '[x]' : '[ ]';
                    return `- ${checkbox} ${convertInlineHTML(item.text || '')}`;
                })
                .join('\n');

        case 'code': {
            const lang = data.languageCode || data.language || '';
            return `\`\`\`${lang}\n${data.code || ''}\n\`\`\``;
        }

        case 'quote': {
            const quoteText = convertInlineHTML(data.text || '');
            const lines = quoteText
                .split('\n')
                .map((line: string) => `> ${line}`)
                .join('\n');
            const caption = data.caption ? `\n>\n> — ${convertInlineHTML(data.caption)}` : '';
            return `${lines}${caption}`;
        }

        case 'delimiter':
            return '---';

        case 'table': {
            const rows: string[][] = data.content || [];
            if (rows.length === 0) return '';

            const headerRow = rows[0].map((cell: string) => convertInlineHTML(cell));
            const header = `| ${headerRow.join(' | ')} |`;
            const separator = `| ${headerRow.map(() => '---').join(' | ')} |`;
            const bodyRows = rows
                .slice(1)
                .map((row: string[]) => `| ${row.map((cell: string) => convertInlineHTML(cell)).join(' | ')} |`)
                .join('\n');

            return bodyRows ? `${header}\n${separator}\n${bodyRows}` : `${header}\n${separator}`;
        }

        case 'warning': {
            const title = convertInlineHTML(data.title || '');
            const message = convertInlineHTML(data.message || '');
            return `> ⚠️ **${title}**: ${message}`;
        }

        case 'image':
        case 'advancedImage': {
            const url = data.file?.url || data.url || '';
            const alt = data.alt || data.caption || '';
            const caption = data.caption || '';
            return caption ? `![${alt}](${url} "${caption}")` : `![${alt}](${url})`;
        }

        case 'embed': {
            const embedUrl = data.source || data.embed || data.url || '';
            const caption = data.caption ? convertInlineHTML(data.caption) : '';
            return caption ? `[${caption}](${embedUrl})` : embedUrl;
        }

        case 'raw':
            return `<!-- raw html -->\n${data.html || ''}\n<!-- /raw html -->`;

        case 'spoiler': {
            const title = convertInlineHTML(data.title || 'Spoiler');
            const content = convertInlineHTML(data.content || '');
            return `<details><summary>${title}</summary>${content}</details>`;
        }

        case 'cta': {
            const text = convertInlineHTML(data.text || 'Click here');
            const url = data.url || '#';
            return `[${text}](${url})`;
        }

        case 'review': {
            const parts: string[] = [];
            if (data.title) parts.push(`### ${convertInlineHTML(data.title)}`);
            if (data.rating != null) {
                const stars = '★'.repeat(Math.round(data.rating)) + '☆'.repeat(5 - Math.round(data.rating));
                parts.push(`**Rating:** ${stars} (${data.rating}/5)`);
            }
            if (data.summary) parts.push(convertInlineHTML(data.summary));
            if (data.pros?.length) parts.push(`**Pros:** ${data.pros.map(convertInlineHTML).join(', ')}`);
            if (data.cons?.length) parts.push(`**Cons:** ${data.cons.map(convertInlineHTML).join(', ')}`);
            return parts.join('\n\n');
        }

        case 'faq':
            return (data.items || [])
                .map((item: { question: string; answer: string }) => {
                    const q = convertInlineHTML(item.question || '');
                    const a = convertInlineHTML(item.answer || '');
                    return `**Q:** ${q}\n\n**A:** ${a}`;
                })
                .join('\n\n');

        case 'testimonial': {
            const parts: string[] = [];
            if (data.quote) parts.push(`> ${convertInlineHTML(data.quote)}`);
            const attribution: string[] = [];
            if (data.authorName) attribution.push(`**${convertInlineHTML(data.authorName)}**`);
            if (data.authorRole) attribution.push(convertInlineHTML(data.authorRole));
            if (data.authorCompany) attribution.push(convertInlineHTML(data.authorCompany));
            if (attribution.length) parts.push(`> — ${attribution.join(', ')}`);
            if (data.rating != null && data.rating > 0) {
                const stars = '★'.repeat(Math.round(data.rating)) + '☆'.repeat(5 - Math.round(data.rating));
                parts.push(`> ${stars}`);
            }
            return parts.join('\n');
        }

        case 'steps':
            return (data.items || [])
                .map((item: { title: string; content: string }, i: number) => {
                    const title = convertInlineHTML(item.title || '');
                    const content = convertInlineHTML(item.content || '');
                    return content ? `${i + 1}. **${title}** — ${content}` : `${i + 1}. **${title}**`;
                })
                .join('\n');

        case 'disclosure': {
            const parts: string[] = [];
            if (data.aiEnabled) {
                const levelText = getAIDisclosureText(data.aiLevel, data.aiPercent);
                parts.push(`[^ai]: ${levelText}`);
            }
            if (data.sponsoredEnabled) {
                const sponsoredText =
                    data.sponsoredType === 'custom' && data.sponsoredText
                        ? data.sponsoredText
                        : 'This content was created in partnership with a sponsor.';
                parts.push(`[^sponsored]: ${sponsoredText}`);
            }
            return parts.join('\n\n') || '<!-- disclosure -->';
        }

        case 'map': {
            const url = data.url || data.embedUrl || '';
            return url ? `[View Map](${url})` : '<!-- map block: no URL -->';
        }

        case 'mediaEmbed': {
            const url = data.url || '';
            const caption = data.caption || data.title || '';
            return caption ? `[${convertInlineHTML(caption)}](${url})` : `[media](${url})`;
        }

        case 'mediaGallery': {
            const items = data.items || [];
            if (items.length === 0) return '<!-- empty media gallery -->';
            return items
                .map((item: { url: string; altText?: string; caption?: string; title?: string }) => {
                    const alt = item.altText || item.caption || item.title || '';
                    return `![${alt}](${item.url})`;
                })
                .join('\n');
        }

        case 'beforeAfter': {
            const lines: string[] = ['### Before / After'];
            if (data.beforeUrl) lines.push(`**${data.beforeLabel || 'Before'}:** ![before](${data.beforeUrl})`);
            if (data.afterUrl) lines.push(`**${data.afterLabel || 'After'}:** ![after](${data.afterUrl})`);
            if (data.caption) lines.push(`*${convertInlineHTML(data.caption)}*`);
            return lines.join('\n\n');
        }

        case 'imageHotspots': {
            const lines: string[] = [];
            if (data.imageUrl) lines.push(`![${data.alt || ''}](${data.imageUrl})`);
            const hotspots = data.hotspots || [];
            if (hotspots.length > 0) {
                lines.push('');
                hotspots.forEach((hs: { title: string; content: string; x: number; y: number }, idx: number) => {
                    const title = hs.title || `Hotspot ${idx + 1}`;
                    lines.push(`${idx + 1}. **${title}** — ${hs.content || ''}`);
                });
            }
            if (data.caption) lines.push(`\n*${convertInlineHTML(data.caption)}*`);
            return lines.join('\n');
        }

        default:
            return `<!-- unknown block: ${type} -->`;
    }
}

/**
 * Recursively renders list items (supports nested lists)
 */
function renderListItems(
    items: Array<string | { content: string; items?: any[] }>,
    style: string,
    depth: number,
): string {
    const indent = '  '.repeat(depth);
    const lines: string[] = [];

    items.forEach((item, index) => {
        const prefix = style === 'ordered' ? `${index + 1}. ` : '- ';

        if (typeof item === 'string') {
            lines.push(`${indent}${prefix}${convertInlineHTML(item)}`);
        } else {
            lines.push(`${indent}${prefix}${convertInlineHTML(item.content || '')}`);
            if (item.items?.length) {
                lines.push(renderListItems(item.items, style, depth + 1));
            }
        }
    });

    return lines.join('\n');
}

/**
 * Returns human-readable AI disclosure text based on level
 */
function getAIDisclosureText(level: string, percent?: number): string {
    switch (level) {
        case 'slight':
            return 'AI tools were used to assist in light editing and proofreading.';
        case 'mid':
            return 'AI tools were significantly used in drafting and editing.';
        case 'high':
            return 'This content was primarily generated with AI assistance.';
        case 'custom':
            return `Approximately ${percent || 0}% of this content was created with AI assistance.`;
        default:
            return 'AI tools were used in creating this content.';
    }
}

/**
 * Converts EditorJS OutputData blocks to a Markdown string.
 * Each block is separated by a blank line.
 */
export function exportToMarkdown(data: OutputData): string {
    if (!data?.blocks?.length) return '';

    return data.blocks.map(blockToMarkdown).join('\n\n');
}
