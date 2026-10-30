import { sanitizeBlockHtml } from '@ottabase/utils/sanitize';
import type { BlockRenderer } from '../types';

/** Author-supplied HTML, passed through `sanitizeBlockHtml` and styled like HtmlRenderer output. */
const Raw: BlockRenderer<{ html?: string }> = ({ data }) => {
    if (!data?.html) return null;
    return (
        <div
            className="otta-raw ottarenderer--html"
            dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(data.html) }}
        />
    );
};

export default Raw;
