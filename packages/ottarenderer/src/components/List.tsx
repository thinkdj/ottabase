import { Inline } from '../inline';
import type { BlockRenderer } from '../types';
import { CheckMark } from './Checklist';

/**
 * Editor.js has shipped three list payloads and all of them reach this renderer, so stored
 * content never needs migrating:
 *  - @editorjs/nested-list  `{ style, items: [{ content, items }] }`  (what ottaeditor writes)
 *  - @editorjs/list v1      `{ style, items: ['a', 'b'] }`
 *  - @editorjs/list v2      `{ style: 'ordered' | 'unordered' | 'checklist', meta, items: [{ content, meta, items }] }`
 */
export type ListStyle = 'ordered' | 'unordered' | 'checklist';

export interface ListItem {
    content?: string;
    items?: unknown[];
    meta?: { checked?: boolean };
}

export interface ListData {
    style?: ListStyle | string;
    items?: unknown[];
    meta?: { start?: number; counterType?: string };
}

const COUNTERS: Record<string, string> = {
    numeric: 'decimal',
    'lower-roman': 'lower-roman',
    'upper-roman': 'upper-roman',
    'lower-alpha': 'lower-alpha',
    'upper-alpha': 'upper-alpha',
};

const toItem = (raw: unknown): ListItem => (typeof raw === 'string' ? { content: raw } : ((raw ?? {}) as ListItem));

function Level({
    items,
    style,
    start,
    counter,
    depth,
}: {
    items: unknown[];
    style: ListStyle;
    start?: number;
    counter?: string;
    depth: number;
}) {
    const Tag = style === 'ordered' ? 'ol' : 'ul';
    return (
        <Tag
            className={`otta-list otta-list--${style}`}
            data-depth={depth}
            start={style === 'ordered' && start && start > 1 ? start : undefined}
            style={counter && COUNTERS[counter] ? { listStyleType: COUNTERS[counter] } : undefined}
        >
            {items.map((raw, i) => {
                const item = toItem(raw);
                const children = Array.isArray(item.items) ? item.items : [];
                const checked = style === 'checklist' ? Boolean(item.meta?.checked) : undefined;
                return (
                    <li key={i} className="otta-list__item" data-checked={checked}>
                        {style === 'checklist' && <CheckMark checked={!!checked} />}
                        <span className="otta-list__text">
                            <Inline html={item.content} />
                        </span>
                        {children.length > 0 && (
                            <Level items={children} style={style} counter={counter} depth={depth + 1} />
                        )}
                    </li>
                );
            })}
        </Tag>
    );
}

const List: BlockRenderer<ListData> = ({ data }) => {
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) return null;
    const style: ListStyle = data?.style === 'ordered' || data?.style === 'checklist' ? data.style : 'unordered';
    return <Level items={items} style={style} start={data?.meta?.start} counter={data?.meta?.counterType} depth={1} />;
};

export default List;
