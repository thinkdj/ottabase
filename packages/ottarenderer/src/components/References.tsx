import { useLinkRel } from '../inline';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import type { BlockRenderer } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReferenceItem {
    id?: string;
    url: string;
    title?: string;
    authors?: string;
    year?: string;
    accessedDate?: string;
    note?: string;
}

export interface ReferencesData {
    items?: ReferenceItem[];
    style?: 'numbered' | 'footnote';
}

// ─── Sub-component ───────────────────────────────────────────────────────────

/** Renders a single reference entry in academic bibliography style. */
function ReferenceEntry({
    item,
    index,
    style,
}: {
    item: ReferenceItem;
    index: number;
    style: 'numbered' | 'footnote';
}) {
    const linkRel = useLinkRel();
    const label = style === 'footnote' ? `${index + 1}` : `[${index + 1}]`;

    const urlDisplay = item.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    return (
        <li className="otta-references-item">
            <span className="otta-references-label" aria-label={`Reference ${index + 1}`}>
                {label}
            </span>
            <span className="otta-references-body">
                {item.authors && <span className="otta-references-authors">{item.authors}</span>}
                {item.year && <span className="otta-references-year"> ({item.year})</span>}
                {(item.authors || item.year) && '. '}
                {item.title ? (
                    <a
                        href={sanitizeUrl(item.url)}
                        target="_blank"
                        rel={linkRel(true)}
                        className="otta-references-link"
                    >
                        {item.title}
                    </a>
                ) : (
                    <a
                        href={sanitizeUrl(item.url)}
                        target="_blank"
                        rel={linkRel(true)}
                        className="otta-references-link"
                    >
                        {urlDisplay}
                    </a>
                )}
                {item.accessedDate && <span className="otta-references-accessed"> (accessed {item.accessedDate})</span>}
                {item.note && <span className="otta-references-note"> — {item.note}</span>}
            </span>
        </li>
    );
}

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * References block renderer.
 *
 * Renders an academic-style bibliography list.
 * - `numbered` (default): renders `[1] Authors (Year). Title. URL`
 * - `footnote`: renders with superscript-style numbering
 */
const References: BlockRenderer<ReferencesData> = ({ data, className = '' }) => {
    const items = data?.items ?? [];
    const style = data?.style ?? 'numbered';

    // Only render items that have at least a URL
    const validItems = items.filter((item) => item.url?.trim());

    if (validItems.length === 0) {
        return null;
    }

    const ListTag = style === 'numbered' ? 'ol' : 'ul';

    return (
        <div className={`${className} otta-references otta-references--${style} not-prose`}>
            <ListTag className="otta-references-list">
                {validItems.map((item, index) => (
                    <ReferenceEntry key={item.id ?? index} item={item} index={index} style={style} />
                ))}
            </ListTag>
        </div>
    );
};

export default References;
