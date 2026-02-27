// ---------------------------------------------------------------------------
// Ottamenu – Footer menu renderer
// Flat horizontal/wrap layout. Renders only top-level items as links.
// Children are ignored — footer menus are single-level by design.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { buildItemTree } from '../persistence/treeUtils';
import type { MenuItemDto } from '../persistence/types';
import { MenuItemLink } from './MenuItemLink';

export interface FooterMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
}

/**
 * Renders a flat footer menu — top-level items only, no nesting.
 * Children/grandchildren are ignored; use sidebar or mega menu for hierarchy.
 */
export function FooterMenuRenderer({ items, pathname }: FooterMenuRendererProps) {
    // Build tree only to get sorted top-level items
    const tree = useMemo(() => buildItemTree(items), [items]);

    return (
        <nav className="flex flex-wrap gap-4">
            {tree.map((node) => (
                <MenuItemLink key={node.item.id} item={node.item} pathname={pathname} className="!px-0 !py-1 text-sm" />
            ))}
        </nav>
    );
}
