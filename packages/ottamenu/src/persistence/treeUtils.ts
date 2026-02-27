// ---------------------------------------------------------------------------
// Ottamenu – Build tree from flat menu items
// ---------------------------------------------------------------------------

import type { MenuItemDto } from './types';

export interface MenuItemTreeNode {
    item: MenuItemDto;
    children: MenuItemTreeNode[];
}

/**
 * Build a tree from flat menu items.
 * Items with parentId=null are roots; children are nested by parentId.
 * Siblings sorted by sortOrder.
 */
export function buildItemTree(items: MenuItemDto[]): MenuItemTreeNode[] {
    const byParent = new Map<string | null, MenuItemDto[]>();
    for (const it of items) {
        const pid = it.parentId ?? null;
        const arr = byParent.get(pid) ?? [];
        arr.push(it);
        byParent.set(pid, arr);
    }
    // Sort each group by sortOrder, then by name for stable ordering when tied
    for (const arr of byParent.values()) {
        arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || ''));
    }

    function build(parentId: string | null): MenuItemTreeNode[] {
        const list = byParent.get(parentId) ?? [];
        return list.map((item) => ({
            item,
            children: build(item.id),
        }));
    }

    return build(null);
}
