// ---------------------------------------------------------------------------
// Ottamenu: moving items around (pure functions over the flat list)
// Every helper returns a new list with sortOrder renumbered 0..n per parent.
// ---------------------------------------------------------------------------

import type { MenuItemDto } from './types';

export interface MenuItemMove {
    id: string;
    parentId: string | null;
    sortOrder: number;
}

const parentOf = (item: MenuItemDto): string | null => item.parentId ?? null;
const byOrder = (a: MenuItemDto, b: MenuItemDto) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '');

/** Children of one parent (null for the top level) in display order. */
export function siblingsOf(items: MenuItemDto[], parentId: string | null): MenuItemDto[] {
    return items.filter((item) => parentOf(item) === parentId).sort(byOrder);
}

/** True when `id` sits somewhere below `ancestorId`. */
export function isDescendant(items: MenuItemDto[], id: string, ancestorId: string): boolean {
    const byId = new Map(items.map((item) => [item.id, item]));
    const seen = new Set<string>();
    let current = byId.get(id)?.parentId ?? null;
    while (current && !seen.has(current)) {
        if (current === ancestorId) return true;
        seen.add(current);
        current = byId.get(current)?.parentId ?? null;
    }
    return false;
}

/** Renumber sortOrder 0..n inside every parent group, keeping the current order. */
export function normalizeOrder(items: MenuItemDto[]): MenuItemDto[] {
    const position = new Map<string, number>();
    for (const parentId of new Set(items.map(parentOf))) {
        siblingsOf(items, parentId).forEach((item, index) => position.set(item.id, index));
    }
    return items.map((item) => ({ ...item, parentId: parentOf(item), sortOrder: position.get(item.id) ?? 0 }));
}

/** Swap an item with the sibling above (-1) or below (+1). Unchanged at the edge. */
export function moveItem(items: MenuItemDto[], id: string, delta: -1 | 1): MenuItemDto[] {
    const base = normalizeOrder(items);
    const item = base.find((i) => i.id === id);
    if (!item) return items;
    const siblings = siblingsOf(base, parentOf(item));
    const index = siblings.findIndex((i) => i.id === id);
    const neighbour = siblings[index + delta];
    if (!neighbour) return items;
    return normalizeOrder(
        base.map((i) =>
            i.id === id ? { ...i, sortOrder: index + delta } : i.id === neighbour.id ? { ...i, sortOrder: index } : i,
        ),
    );
}

/** Make the item the last child of the sibling above it. Unchanged when it is first. */
export function indentItem(items: MenuItemDto[], id: string): MenuItemDto[] {
    const base = normalizeOrder(items);
    const item = base.find((i) => i.id === id);
    if (!item) return items;
    const siblings = siblingsOf(base, parentOf(item));
    const newParent = siblings[siblings.findIndex((i) => i.id === id) - 1];
    if (!newParent) return items;
    const childCount = siblingsOf(base, newParent.id).length;
    return normalizeOrder(base.map((i) => (i.id === id ? { ...i, parentId: newParent.id, sortOrder: childCount } : i)));
}

/** Lift the item out of its parent and place it right after that parent. Unchanged at the top level. */
export function outdentItem(items: MenuItemDto[], id: string): MenuItemDto[] {
    const base = normalizeOrder(items);
    const item = base.find((i) => i.id === id);
    const parent = item && base.find((i) => i.id === parentOf(item));
    if (!item || !parent) return items;
    return normalizeOrder(
        base.map((i) =>
            i.id === id ? { ...i, parentId: parentOf(parent), sortOrder: (parent.sortOrder ?? 0) + 0.5 } : i,
        ),
    );
}

/** Drop an item before or after another one, in that one's group. Nothing moves into its own subtree. */
export function placeItem(items: MenuItemDto[], id: string, targetId: string, position: 'before' | 'after') {
    if (id === targetId) return items;
    const base = normalizeOrder(items);
    const item = base.find((i) => i.id === id);
    const target = base.find((i) => i.id === targetId);
    if (!item || !target || isDescendant(base, targetId, id)) return items;
    const sortOrder = (target.sortOrder ?? 0) + (position === 'before' ? -0.5 : 0.5);
    return normalizeOrder(base.map((i) => (i.id === id ? { ...i, parentId: parentOf(target), sortOrder } : i)));
}

/** The moves that turn `before` into `after`: only items whose parent or position differs. */
export function orderChanges(before: MenuItemDto[], after: MenuItemDto[]): MenuItemMove[] {
    const previous = new Map(before.map((item) => [item.id, item]));
    return after
        .filter((item) => {
            const old = previous.get(item.id);
            return !old || parentOf(old) !== parentOf(item) || (old.sortOrder ?? 0) !== (item.sortOrder ?? 0);
        })
        .map((item) => ({ id: item.id, parentId: parentOf(item), sortOrder: item.sortOrder ?? 0 }));
}
