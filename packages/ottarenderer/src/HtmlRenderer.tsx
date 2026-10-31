import { markUgcLinks, sanitizeBlockHtml } from '@ottabase/utils/sanitize';

export interface HtmlRendererProps {
    content: string;
    className?: string;
    /** User-generated HTML: every link gets `rel="ugc nofollow noopener"`. */
    ugc?: boolean;
}

/**
 * Renders a trusted-ish HTML string (an imported post, a CMS field) with the same typography the
 * block renderer uses. Everything passes through `sanitizeBlockHtml` first.
 */
export function HtmlRenderer({ content, className, ugc = false }: HtmlRendererProps) {
    const html = sanitizeBlockHtml(content);
    return (
        <div
            className={['ottarenderer ottarenderer--html', className].filter(Boolean).join(' ')}
            data-slot="renderer"
            dangerouslySetInnerHTML={{ __html: ugc ? markUgcLinks(html) : html }}
        />
    );
}

export default HtmlRenderer;
