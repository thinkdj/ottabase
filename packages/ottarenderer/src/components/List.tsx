import { sanitizeInlineHtml } from '@ottabase/utils/sanitize';
import { RenderFn } from 'editorjs-blocks-react-renderer';
import './List.css';

/**
 * EditorJS ships two list payloads and both reach this renderer:
 * `@editorjs/list` stores plain strings (`items: ['a', 'b']`) while
 * `@editorjs/nested-list` stores objects (`items: [{ content, items }]`).
 * Normalizing here keeps one malformed item from throwing and taking the whole
 * article page down through the route error boundary.
 */
interface ListItem {
    content?: string;
    items?: unknown[];
}

const toListItem = (item: unknown): ListItem =>
    typeof item === 'string' ? { content: item } : ((item ?? {}) as ListItem);

const List: RenderFn<{ items?: unknown[]; style?: string }> = ({ data, className = '', level = 1 }) => {
    const ListTag: 'ol' | 'ul' = data?.style === 'ordered' ? 'ol' : 'ul';

    return (
        <ListTag className={`${className} cdc-content-list-${ListTag}`}>
            {data?.items?.map((rawItem, i) => {
                const item = toListItem(rawItem);
                const children = item.items ?? [];

                return (
                    <li key={i} className={`cdc-content-list cdc-content-list-l${level} text-foreground text-base/7`}>
                        {/* EditorJS list items often include inline HTML (e.g. <strong>) */}
                        <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(item.content ?? '') }} />
                        {/* Nested levels inherit the parent style — EditorJS stores it once per block */}
                        {children.length > 0 && (
                            <List data={{ items: children, style: data?.style }} level={level + 1} />
                        )}
                    </li>
                );
            })}
        </ListTag>
    );
};

export default List;
