// ---------------------------------------------------------------------------
// Ottamenu – Dropdown menu renderer
// Simple single-column dropdown list. Good for context menus, action menus,
// or compact navigation dropdowns.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { buildItemTree, type MenuItemTreeNode } from '../treeUtils';
import type { MenuItemDto } from '../types';
import { MenuItemLink } from './MenuItemLink';

export interface DropdownMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
}

// ── Single dropdown item with optional image + description ───────────────
function DropdownItem({ node, depth, pathname }: { node: MenuItemTreeNode; depth: number; pathname: string }) {
    const item = node.item;
    const hasImage = !!item.image;
    const hasDescription = !!item.description;

    return (
        <div className={depth > 0 ? 'ml-3 border-l border-muted pl-1' : ''}>
            <MenuItemLink
                item={item}
                pathname={pathname}
                className="block w-full"
                renderChildren={
                    <span className="flex items-center gap-2.5">
                        {hasImage && <img src={item.image!} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />}
                        <span className="flex flex-col">
                            <span className="text-sm">{item.name}</span>
                            {hasDescription && (
                                <span className="text-xs text-muted-foreground">{item.description}</span>
                            )}
                        </span>
                    </span>
                }
            />

            {/* Recursive nested children */}
            {node.children.length > 0 && (
                <div className="mt-0.5">
                    {node.children.map((child) => (
                        <DropdownItem key={child.item.id} node={child} depth={depth + 1} pathname={pathname} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Renders a simple single-column dropdown menu.
 * Supports nested items, images, and descriptions.
 * Ideal for context menus, action menus, or compact nav dropdowns.
 */
export function DropdownMenuRenderer({ items, pathname }: DropdownMenuRendererProps) {
    const tree = useMemo(() => buildItemTree(items), [items]);

    return (
        <div className="min-w-[200px] rounded-lg border bg-popover p-1 shadow-md">
            {tree.map((node) => (
                <DropdownItem key={node.item.id} node={node} depth={0} pathname={pathname} />
            ))}
        </div>
    );
}
