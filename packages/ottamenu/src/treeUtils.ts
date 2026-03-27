// ---------------------------------------------------------------------------
// Ottamenu – Build tree from flat menu items (pure function, no ORM)
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
 * Orphaned items (parentId points to non-existent) and items in cycles are treated as roots.
 */
export function buildItemTree(items: MenuItemDto[]): MenuItemTreeNode[] {
    if (!items?.length) return [];

    const byId = new Map<string, MenuItemDto>();
    for (const it of items) byId.set(it.id, it);

    /** Detect if parentId chain from item leads back to item (cycle) */
    function isInCycle(itemId: string): boolean {
        const seen = new Set<string>();
        let id: string | null = itemId;
        while (id) {
            if (seen.has(id)) return true;
            seen.add(id);
            const item = byId.get(id);
            id = item?.parentId ?? null;
        }
        return false;
    }

    const byParent = new Map<string | null, MenuItemDto[]>();
    for (const it of items) {
        const pid = it.parentId ?? null;
        const parentExists = pid !== null && byId.has(pid);
        const wouldCycle = parentExists && isInCycle(it.id);
        const effectiveParent = parentExists && !wouldCycle ? pid : null;
        const arr = byParent.get(effectiveParent) ?? [];
        arr.push(it);
        byParent.set(effectiveParent, arr);
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

    const roots = build(null);
    // If no roots (e.g. all in cycles), treat all items as roots to avoid empty output
    if (roots.length === 0) {
        return items.map((item) => ({ item, children: [] }));
    }
    return roots;
}
