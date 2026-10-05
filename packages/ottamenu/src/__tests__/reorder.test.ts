import { describe, expect, it } from 'vitest';
import { indentItem, moveItem, orderChanges, outdentItem, placeItem, siblingsOf } from '../reorder';
import type { MenuItemDto } from '../types';

const item = (id: string, sortOrder: number, parentId: string | null = null): MenuItemDto => ({
    id,
    name: id,
    link: `/${id}`,
    menuId: 'm',
    parentId,
    sortOrder,
});
const order = (items: MenuItemDto[], parentId: string | null = null) => siblingsOf(items, parentId).map((i) => i.id);

// home, about (team, history), contact
const menu = [
    item('home', 0),
    item('about', 1),
    item('team', 0, 'about'),
    item('history', 1, 'about'),
    item('contact', 2),
];

describe('reorder', () => {
    it('moves an item among its siblings and stops at the edges', () => {
        expect(order(moveItem(menu, 'about', 1))).toEqual(['home', 'contact', 'about']);
        expect(order(moveItem(menu, 'history', -1), 'about')).toEqual(['history', 'team']);
        expect(moveItem(menu, 'home', -1)).toBe(menu);
        expect(moveItem(menu, 'nope', 1)).toBe(menu);
    });

    it('indents under the sibling above, as its last child', () => {
        const next = indentItem(menu, 'contact');
        expect(order(next)).toEqual(['home', 'about']);
        expect(order(next, 'about')).toEqual(['team', 'history', 'contact']);
        expect(indentItem(menu, 'home')).toBe(menu);
    });

    it('outdents to right after its parent', () => {
        const next = outdentItem(menu, 'team');
        expect(order(next)).toEqual(['home', 'about', 'team', 'contact']);
        expect(order(next, 'about')).toEqual(['history']);
        expect(outdentItem(menu, 'home')).toBe(menu);
    });

    it('places a dropped item before or after another, in that group', () => {
        expect(order(placeItem(menu, 'contact', 'home', 'before'))).toEqual(['contact', 'home', 'about']);
        const nested = placeItem(menu, 'home', 'team', 'after');
        expect(order(nested)).toEqual(['about', 'contact']);
        expect(order(nested, 'about')).toEqual(['team', 'home', 'history']);
        expect(placeItem(menu, 'about', 'team', 'after')).toBe(menu);
        expect(placeItem(menu, 'about', 'about', 'after')).toBe(menu);
    });

    it('reports only the moves needed', () => {
        const next = moveItem(menu, 'about', 1);
        expect(orderChanges(menu, next)).toEqual([
            { id: 'about', parentId: null, sortOrder: 2 },
            { id: 'contact', parentId: null, sortOrder: 1 },
        ]);
        expect(orderChanges(menu, menu)).toEqual([]);
    });
});
