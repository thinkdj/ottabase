// ---------------------------------------------------------------------------
// Ottamenu – Sidebar menu renderer
// Link list matching SidebarNav styling. Supports nested items.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { buildItemTree, type MenuItemTreeNode } from '../treeUtils';
import type { MenuItemDto } from '../types';
import { MenuItemLink } from './MenuItemLink';

export interface SidebarMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
}

function SidebarNode({ node, depth, pathname }: { node: MenuItemTreeNode; depth: number; pathname: string }) {
    return (
        <div className={depth > 0 ? 'ml-3 mt-0.5 border-l border-muted pl-2' : ''}>
            <MenuItemLink item={node.item} pathname={pathname} className="whitespace-nowrap md:whitespace-normal" />
            {node.children.length > 0 && (
                <div className="mt-1 space-y-0">
                    {node.children.map((child) => (
                        <SidebarNode key={child.item.id} node={child} depth={depth + 1} pathname={pathname} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Renders menu items as a sidebar nav (vertical link list). Supports nested children.
 */
export function SidebarMenuRenderer({ items, pathname }: SidebarMenuRendererProps) {
    const tree = useMemo(() => buildItemTree(items), [items]);

    return (
        <nav className="flex flex-col gap-0.5">
            {tree.map((node) => (
                <SidebarNode key={node.item.id} node={node} depth={0} pathname={pathname} />
            ))}
        </nav>
    );
}
