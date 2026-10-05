import { beforeEach, describe, expect, it, vi } from 'vitest';

const { menuFind, itemWhere, warm } = vi.hoisted(() => ({ menuFind: vi.fn(), itemWhere: vi.fn(), warm: vi.fn() }));

vi.mock('../persistence/Menu.model', () => ({ Menu: { find: menuFind } }));
vi.mock('../persistence/MenuItem.model', () => ({ MenuItem: { where: itemWhere } }));
vi.mock('../persistence/menuData', () => ({ getMenuBySlug: vi.fn() }));
vi.mock('../handlers/warm-cache', () => ({ warmBrandCache: warm }));

import { handleReorderMenuItems } from '../handlers/menu-crud-api';

const ENV = {} as any;
const put = (body: unknown) =>
    new Request('http://x/api/brand/menus/m1/items/order', { method: 'PUT', body: JSON.stringify(body) });

function fakeItem(id: string, parentId: string | null = null) {
    const data: Record<string, unknown> = { id, menuId: 'm1', parentId, name: id, link: `/${id}`, sortOrder: 0 };
    return { get: (k: string) => data[k], set: vi.fn((k: string, v: unknown) => (data[k] = v)), save: vi.fn() };
}

describe('handleReorderMenuItems', () => {
    let home: ReturnType<typeof fakeItem>;
    let about: ReturnType<typeof fakeItem>;
    let team: ReturnType<typeof fakeItem>;

    beforeEach(() => {
        vi.clearAllMocks();
        menuFind.mockResolvedValue({ get: (k: string) => ({ id: 'm1', appId: 'app', name: 'Main', slug: 'main' })[k] });
        home = fakeItem('home');
        about = fakeItem('about');
        team = fakeItem('team', 'about');
        itemWhere.mockResolvedValue([home, about, team]);
    });

    it('writes every move and warms the cache once', async () => {
        const res = await handleReorderMenuItems(
            put({
                items: [
                    { id: 'home', parentId: null, sortOrder: 1 },
                    { id: 'about', parentId: null, sortOrder: 0 },
                ],
            }),
            ENV,
            'm1',
            'app',
        );
        expect(res.status).toBe(200);
        expect(home.set).toHaveBeenCalledWith('sortOrder', 1);
        expect(about.set).toHaveBeenCalledWith('sortOrder', 0);
        expect(home.save).toHaveBeenCalled();
        expect(warm).toHaveBeenCalledTimes(1);
    });

    it('refuses an unknown item or parent without writing', async () => {
        const unknownItem = await handleReorderMenuItems(
            put({ items: [{ id: 'nope', sortOrder: 0 }] }),
            ENV,
            'm1',
            'app',
        );
        const unknownParent = await handleReorderMenuItems(
            put({ items: [{ id: 'home', parentId: 'nope', sortOrder: 0 }] }),
            ENV,
            'm1',
            'app',
        );
        expect(unknownItem.status).toBe(400);
        expect(unknownParent.status).toBe(400);
        expect(home.save).not.toHaveBeenCalled();
        expect(warm).not.toHaveBeenCalled();
    });

    it('refuses a move that puts an item inside itself', async () => {
        const res = await handleReorderMenuItems(
            put({ items: [{ id: 'about', parentId: 'team', sortOrder: 0 }] }),
            ENV,
            'm1',
            'app',
        );
        expect(res.status).toBe(400);
        expect(about.save).not.toHaveBeenCalled();
    });

    it('hides a menu that belongs to another app', async () => {
        menuFind.mockResolvedValue({ get: (k: string) => (k === 'appId' ? 'other' : null) });
        const res = await handleReorderMenuItems(put({ items: [] }), ENV, 'm1', 'app');
        expect(res.status).toBe(404);
    });
});
