import { nodesToText, renderNodes, useInline } from '../inline';
import { useHeadingId } from '../scope';
import type { BlockRenderer } from '../types';

export interface HeaderData {
    text?: string;
    level?: number;
}

/**
 * A heading. Gets a stable slug id from its text so sections can be deep-linked and a table of
 * contents can be built from the DOM; a hover anchor copies that link.
 */
const Header: BlockRenderer<HeaderData> = ({ data, block }) => {
    const raw = data?.level;
    const level = typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.min(6, Math.round(raw)) : 2;
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    const nodes = useInline(data?.text);
    const text = nodesToText(nodes);
    const id = useHeadingId(block, text) ?? block?.id;
    return (
        <Tag id={id} className={`otta-heading otta-heading--${level}`}>
            {renderNodes(nodes)}
            {/* The "#" is drawn by CSS so the heading's textContent stays clean for table-of-contents builders */}
            {id && <a className="otta-heading__anchor" href={`#${id}`} aria-label={`Link to section: ${text}`} />}
        </Tag>
    );
};

export default Header;
