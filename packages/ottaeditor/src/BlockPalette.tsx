import { useMemo, useState } from 'react';
import { BLOCK_GROUPS, BLOCKS, type BlockGroup, type BlockMeta } from './blocks';
import type { OttaEditor } from './OttaEditor';
import { icon } from './ui/icons';

export interface BlockPaletteProps {
    /** The editor to insert into; `null` renders the palette disabled */
    editor: OttaEditor | null;
    /** Limit to these block types (e.g. the names the editor was configured with). Default: all. */
    available?: string[];
    /** Hide whole groups */
    hideGroups?: BlockGroup[];
    /** Called after a block was inserted */
    onInsert?: (type: string) => void;
    className?: string;
    /** Show the search box. Default true. */
    searchable?: boolean;
}

/**
 * Every block, grouped and searchable, with a one-line description: the "what can I add here?"
 * answer Editor.js's flat toolbox cannot give. Host apps render it beside the editor (a sidebar,
 * a sheet, a popover); clicking an entry inserts the block after the current one.
 */
export function BlockPalette({
    editor,
    available,
    hideGroups = [],
    onInsert,
    className,
    searchable = true,
}: BlockPaletteProps) {
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();

    const groups = useMemo(() => {
        const allowed = available ? new Set(available) : null;
        const matches = (b: BlockMeta) =>
            !q ||
            b.title.toLowerCase().includes(q) ||
            b.description.toLowerCase().includes(q) ||
            b.keywords?.some((k) => k.includes(q));
        return BLOCK_GROUPS.filter((g) => !hideGroups.includes(g.key))
            .map((g) => ({
                ...g,
                blocks: BLOCKS.filter((b) => b.group === g.key && (!allowed || allowed.has(b.type)) && matches(b)),
            }))
            .filter((g) => g.blocks.length > 0);
    }, [available, hideGroups, q]);

    const insert = (type: string) => {
        if (!editor) return;
        editor.insertBlock(type);
        onInsert?.(type);
    };

    return (
        <div className={['oe-palette', className].filter(Boolean).join(' ')} data-slot="block-palette">
            {searchable && (
                <input
                    type="search"
                    className="oe-input oe-palette__search"
                    placeholder="Find a block"
                    aria-label="Find a block"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            )}
            {groups.length === 0 && <p className="oe-hint oe-palette__empty">No block matches “{query}”.</p>}
            {groups.map((group) => (
                <section key={group.key} className="oe-palette__group" aria-labelledby={`oe-palette-${group.key}`}>
                    <h3 id={`oe-palette-${group.key}`} className="oe-section-label">
                        {group.label}
                    </h3>
                    <div className="oe-palette__list" role="list">
                        {group.blocks.map((b) => (
                            <button
                                key={b.type}
                                type="button"
                                role="listitem"
                                className="oe-palette__item"
                                disabled={!editor}
                                onClick={() => insert(b.type)}
                                title={`Insert ${b.title}`}
                            >
                                <span
                                    className="oe-palette__icon"
                                    dangerouslySetInnerHTML={{ __html: icon(b.icon, 18) }}
                                />
                                <span className="oe-palette__text">
                                    <span className="oe-palette__title">{b.title}</span>
                                    <span className="oe-palette__desc">{b.description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
