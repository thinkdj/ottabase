import { sanitizeBlockHtml } from '@ottabase/utils/sanitize';
import React from 'react';

interface HtmlRendererProps {
    content: string;
    className?: string;
}

/**
 * HtmlRenderer - Renders basic HTML content with proper styling
 * Supports: p, h1, h2, h3, h4, h5, h6, ul, ol, li, a, strong, em, code, pre, blockquote
 */
const HtmlRenderer: React.FC<HtmlRendererProps> = ({ content, className = '' }) => {
    return (
        <div
            className={`html-renderer prose dark:prose-invert max-w-none ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(content) }}
        />
    );
};

export default HtmlRenderer;
