import { sanitizeBlockHtml } from '@ottabase/utils/sanitize';
import { RenderFn } from 'editorjs-blocks-react-renderer';

/**
 * Raw HTML block. Replaces the library default, which parses `data.html` unsanitized.
 */
const Raw: RenderFn<{ html?: string }> = ({ data, className = '' }) => {
    if (!data?.html) return null;
    return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(data.html) }} />;
};

export default Raw;
