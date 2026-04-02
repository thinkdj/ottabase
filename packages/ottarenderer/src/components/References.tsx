import { RenderFn } from 'editorjs-blocks-react-renderer';
import React from 'react';

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
    const label = style === 'footnote' ? `${index + 1}` : `[${index + 1}]`;

    const urlDisplay = item.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    return (
        <li className="cdc-references-item">
            <span className="cdc-references-label" aria-label={`Reference ${index + 1}`}>
                {label}
            </span>
            <span className="cdc-references-body">
                {item.authors && <span className="cdc-references-authors">{item.authors}</span>}
                {item.year && <span className="cdc-references-year"> ({item.year})</span>}
                {(item.authors || item.year) && '. '}
                {item.title ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="cdc-references-link">
                        {item.title}
                    </a>
                ) : (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="cdc-references-link">
                        {urlDisplay}
                    </a>
                )}
                {item.accessedDate && <span className="cdc-references-accessed"> (accessed {item.accessedDate})</span>}
                {item.note && <span className="cdc-references-note"> — {item.note}</span>}
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
const References: RenderFn<ReferencesData> = ({ data, className = '' }) => {
    const items = data?.items ?? [];
    const style = data?.style ?? 'numbered';

    // Only render items that have at least a URL
    const validItems = items.filter((item) => item.url?.trim());

    if (validItems.length === 0) {
        return null;
    }

    const ListTag = style === 'numbered' ? 'ol' : 'ul';

    return (
        <div className={`${className} cdc-references cdc-references--${style} not-prose`}>
            <ListTag className="cdc-references-list">
                {validItems.map((item, index) => (
                    <ReferenceEntry key={item.id ?? index} item={item} index={index} style={style} />
                ))}
            </ListTag>
        </div>
    );
};

export default References;
