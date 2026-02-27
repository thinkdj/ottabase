// ---------------------------------------------------------------------------
// Ottamenu – Tree builder tests (pure logic, no React)
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { buildItemTree } from '../persistence/treeUtils';
import type { MenuItemDto } from '../persistence/types';

/** Helper: create a minimal MenuItemDto */
function item(overrides: Partial<MenuItemDto> & { id: string; name: string }): MenuItemDto {
    return {
        menuId: 'menu-1',
        link: `/${overrides.name.toLowerCase().replace(/\s/g, '-')}`,
        sortOrder: 0,
        ...overrides,
    };
}

describe('buildItemTree', () => {
    it('returns empty array for empty input', () => {
        expect(buildItemTree([])).toEqual([]);
    });

    it('creates flat list when all items are top-level', () => {
        const items = [
            item({ id: '1', name: 'Home' }),
            item({ id: '2', name: 'About' }),
            item({ id: '3', name: 'Contact' }),
        ];
        const tree = buildItemTree(items);
        expect(tree).toHaveLength(3);
        tree.forEach((n) => expect(n.children).toEqual([]));
    });

    it('nests children under their parent', () => {
        const items = [
            item({ id: 'parent', name: 'Products' }),
            item({ id: 'child-1', name: 'Claude', parentId: 'parent' }),
            item({ id: 'child-2', name: 'Claude Code', parentId: 'parent' }),
        ];
        const tree = buildItemTree(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].item.id).toBe('parent');
        expect(tree[0].children).toHaveLength(2);
    });

    it('sorts siblings by sortOrder then name', () => {
        const items = [
            item({ id: '3', name: 'Zebra', sortOrder: 1 }),
            item({ id: '1', name: 'Alpha', sortOrder: 0 }),
            item({ id: '2', name: 'Beta', sortOrder: 0 }),
        ];
        const tree = buildItemTree(items);
        expect(tree.map((n) => n.item.name)).toEqual(['Alpha', 'Beta', 'Zebra']);
    });

    it('handles multi-level nesting (3 deep)', () => {
        const items = [
            item({ id: 'l0', name: 'Platform' }),
            item({ id: 'l1', name: 'Products', parentId: 'l0' }),
            item({ id: 'l2', name: 'Claude', parentId: 'l1' }),
        ];
        const tree = buildItemTree(items);
        expect(tree).toHaveLength(1);
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].children).toHaveLength(1);
        expect(tree[0].children[0].children[0].item.name).toBe('Claude');
    });

    it('handles parentId=null as top-level', () => {
        const items = [
            item({ id: '1', name: 'Home', parentId: null }),
            item({ id: '2', name: 'About', parentId: undefined }),
        ];
        const tree = buildItemTree(items);
        expect(tree).toHaveLength(2);
    });
});
