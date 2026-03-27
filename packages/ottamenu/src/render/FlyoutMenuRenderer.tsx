// ---------------------------------------------------------------------------
// Ottamenu – Flyout menu renderer
// Compact dropdown-style list with border/shadow. Supports nested items.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { buildItemTree, type MenuItemTreeNode } from '../treeUtils';
import type { MenuItemDto } from '../types';
import { MenuItemLink } from './MenuItemLink';

export interface FlyoutMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
}

function FlyoutNode({ node, depth, pathname }: { node: MenuItemTreeNode; depth: number; pathname: string }) {
    return (
        <div className={depth > 0 ? 'ml-2 border-l border-muted pl-2' : ''}>
            <MenuItemLink item={node.item} pathname={pathname} className="block" />
            {node.children.length > 0 && (
                <div className="mt-0.5">
                    {node.children.map((child) => (
                        <FlyoutNode key={child.item.id} node={child} depth={depth + 1} pathname={pathname} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Renders menu items as a flyout/dropdown (compact list in popover). Nested items are indented.
 */
export function FlyoutMenuRenderer({ items, pathname }: FlyoutMenuRendererProps) {
    const tree = useMemo(() => buildItemTree(items), [items]);

    return (
        <div className="rounded-lg border bg-popover p-1 shadow-md">
            {tree.map((node) => (
                <FlyoutNode key={node.item.id} node={node} depth={0} pathname={pathname} />
            ))}
        </div>
    );
}
