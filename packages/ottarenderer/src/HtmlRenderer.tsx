import { sanitizeBlockHtml } from '@ottabase/utils/sanitize';

export interface HtmlRendererProps {
    content: string;
    className?: string;
}

/**
 * Renders a trusted-ish HTML string (an imported post, a CMS field) with the same typography the
 * block renderer uses. Everything passes through `sanitizeBlockHtml` first.
 */
export function HtmlRenderer({ content, className }: HtmlRendererProps) {
    return (
        <div
            className={['ottarenderer ottarenderer--html', className].filter(Boolean).join(' ')}
            data-slot="renderer"
            dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(content) }}
        />
    );
}

export default HtmlRenderer;
