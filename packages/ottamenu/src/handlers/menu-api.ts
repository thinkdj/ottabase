// ---------------------------------------------------------------------------
// Ottamenu – Menu API handlers
// GET /api/menus (list), GET /api/menus/slug/:slug (by slug with items)
// POST /api/menus, PUT /api/menus/:id, DELETE /api/menus/:id
// POST /api/menus/:id/items, PUT /api/menus/:id/items/:itemId, DELETE /api/menus/:id/items/:itemId
// GET /api/menus/sidebar – public: resolved sidebar menu for app (for SidebarNav)
// ---------------------------------------------------------------------------

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { Menu } from '../persistence/Menu.model';
import { MenuItem } from '../persistence/MenuItem.model';
import { getMenuBySlug } from '../persistence/menuData';
import type { CreateMenuItemPayload, MenuItemDto, MenuWithItemsDto, UpdateMenuItemPayload } from '../persistence/types';

/** Env shape for worker (OBCF_D1 is D1Database from @cloudflare/workers-types) */
export type MenuApiEnv = { OBCF_D1: unknown };

function serializeItem(item: InstanceType<typeof MenuItem>): MenuItemDto {
    return {
        id: item.get('id') as string,
        menuId: item.get('menuId') as string,
        parentId: (item.get('parentId') as string | null) ?? null,
        name: item.get('name') as string,
        link: item.get('link') as string,
        newTab: (item.get('newTab') as boolean) ?? false,
        authRequired: (item.get('authRequired') as boolean) ?? false,
        description: (item.get('description') as string | null) ?? null,
        image: (item.get('image') as string | null) ?? null,
        tooltip: (item.get('tooltip') as string | null) ?? null,
        sortOrder: (item.get('sortOrder') as number) ?? 0,
    };
}

/** Serialize timestamp (handles Date from OttaORM 'date' cast or raw number) */
function toUnixMs(v: unknown): number {
    if (typeof v === 'number') return v;
    if (v instanceof Date) return v.getTime();
    return Date.now();
}

async function menuWithItems(menu: InstanceType<typeof Menu>): Promise<MenuWithItemsDto> {
    const items = (await MenuItem.where(
        { menuId: menu.get('id') as string },
        { orderBy: 'sortOrder', orderDirection: 'asc' },
    )) as InstanceType<typeof MenuItem>[];
    const type = ((menu.get('type') as string) || 'sidebar') as MenuWithItemsDto['type'];
    return {
        id: menu.get('id') as string,
        appId: (menu.get('appId') as string | null) ?? null,
        name: menu.get('name') as string,
        slug: menu.get('slug') as string,
        type,
        isDefault: (menu.get('isDefault') as boolean) ?? true,
        items: items.map(serializeItem),
        createdAt: toUnixMs(menu.get('createdAt')),
        updatedAt: toUnixMs(menu.get('updatedAt')),
    };
}

/** GET /api/menus – List menus for app (batch-loads all items to avoid N+1) */
export async function handleGetMenus(_request: Request, _env: MenuApiEnv, appId: string | null): Promise<Response> {
    const menus = (await Menu.where({ appId: appId ?? null }, { orderBy: 'name' })) as InstanceType<typeof Menu>[];
    if (menus.length === 0) return jsonResponse([], 200);

    // Batch-fetch all items for this appId in one query, then group by menuId
    const allItems = (await MenuItem.where(
        { appId: appId ?? null },
        { orderBy: 'sortOrder', orderDirection: 'asc' },
    )) as InstanceType<typeof MenuItem>[];
    const itemsByMenuId = new Map<string, InstanceType<typeof MenuItem>[]>();
    for (const item of allItems) {
        const mid = item.get('menuId') as string;
        const arr = itemsByMenuId.get(mid) ?? [];
        arr.push(item);
        itemsByMenuId.set(mid, arr);
    }

    const data: MenuWithItemsDto[] = menus.map((menu) => {
        const menuId = menu.get('id') as string;
        const items = itemsByMenuId.get(menuId) ?? [];
        const type = ((menu.get('type') as string) || 'sidebar') as MenuWithItemsDto['type'];
        return {
            id: menuId,
            appId: (menu.get('appId') as string | null) ?? null,
            name: menu.get('name') as string,
            slug: menu.get('slug') as string,
            type,
            isDefault: (menu.get('isDefault') as boolean) ?? true,
            items: items.map(serializeItem),
            createdAt: toUnixMs(menu.get('createdAt')),
            updatedAt: toUnixMs(menu.get('updatedAt')),
        };
    });
    return jsonResponse(data, 200);
}

/** GET /api/menus/sidebar – Public: resolved sidebar menu (for SidebarNav). Falls back to null = use NAV_LINKS_ALL. */
export async function handleGetMenuSidebar(
    _request: Request,
    _env: MenuApiEnv,
    appId: string | null,
): Promise<Response> {
    const menu = await getMenuBySlug('sidebar', appId);
    return jsonResponse(menu, 200);
}

/** GET /api/menus/slug/:slug – Get menu by slug with items */
export async function handleGetMenuBySlug(
    _request: Request,
    _env: MenuApiEnv,
    slug: string,
    appId: string | null,
): Promise<Response> {
    const menu = await getMenuBySlug(slug, appId);
    if (!menu) return errorResponse('Menu not found', 404);
    return jsonResponse(menu, 200);
}

/** GET /api/menus/:id – Get one menu with items */
export async function handleGetMenu(
    _request: Request,
    _env: MenuApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const menu = (await Menu.find(id)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);
    return jsonResponse(await menuWithItems(menu), 200);
}

/** POST /api/menus – Create menu */
export async function handleCreateMenu(request: Request, _env: MenuApiEnv, appId: string | null): Promise<Response> {
    const body = (await request.json()) as { name?: string; slug?: string; type?: string };
    const name = body.name as string;
    const slug = (body.slug as string) || 'sidebar';
    const type = (body.type as string) || 'sidebar';
    if (!name || typeof name !== 'string') return errorResponse('name is required', 400);

    const menu = (await Menu.create({
        appId: appId ?? null,
        name,
        slug,
        type,
        isDefault: true,
    })) as InstanceType<typeof Menu>;
    return jsonResponse(await menuWithItems(menu), 201);
}

/** PUT /api/menus/:id – Update menu */
export async function handleUpdateMenu(
    request: Request,
    _env: MenuApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const menu = (await Menu.find(id)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);

    const body = (await request.json()) as { name?: string; slug?: string; type?: string; isDefault?: boolean };
    if (body.name !== undefined) menu.set('name', body.name);
    if (body.slug !== undefined) menu.set('slug', body.slug);
    if (body.type !== undefined) menu.set('type', body.type);
    if (body.isDefault !== undefined) menu.set('isDefault', body.isDefault);
    await menu.save();
    return jsonResponse(await menuWithItems(menu), 200);
}

/** DELETE /api/menus/:id */
export async function handleDeleteMenu(
    _request: Request,
    _env: MenuApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const menu = (await Menu.find(id)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);
    await menu.destroy();
    return jsonResponse({ success: true }, 200);
}

/** POST /api/menus/:id/items – Create menu item */
export async function handleCreateMenuItem(
    request: Request,
    _env: MenuApiEnv,
    menuId: string,
    appId: string | null,
): Promise<Response> {
    const menu = (await Menu.find(menuId)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);

    const body = (await request.json()) as Omit<CreateMenuItemPayload, 'menuId'> &
        Partial<Pick<CreateMenuItemPayload, 'menuId'>>;
    const name = body.name as string;
    const link = (body.link as string) || '/';
    if (!name || typeof name !== 'string') return errorResponse('name is required', 400);
    let sortOrder = 0;
    if (body.sortOrder !== undefined) {
        const n = Number(body.sortOrder);
        if (!Number.isFinite(n)) return errorResponse('sortOrder must be a number', 400);
        sortOrder = n;
    }

    // Inherit appId strictly from parent menu to preserve RLS boundaries
    const itemAppId = menu.get('appId') as string | null;
    const item = (await MenuItem.create({
        menuId,
        appId: itemAppId,
        parentId: body.parentId ?? null,
        name,
        link,
        newTab: body.newTab ?? false,
        authRequired: body.authRequired ?? false,
        description: body.description ?? null,
        image: body.image ?? null,
        tooltip: body.tooltip ?? null,
        sortOrder,
    })) as InstanceType<typeof MenuItem>;
    return jsonResponse(serializeItem(item), 201);
}

/** PUT /api/menus/:id/items/:itemId – Update menu item */
export async function handleUpdateMenuItem(
    request: Request,
    _env: MenuApiEnv,
    _menuId: string,
    itemId: string,
    appId: string | null,
): Promise<Response> {
    const item = (await MenuItem.find(itemId)) as InstanceType<typeof MenuItem> | null;
    if (!item) return errorResponse('Menu item not found', 404);
    const menu = (await Menu.find(item.get('menuId') as string)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);

    const body = (await request.json()) as Partial<UpdateMenuItemPayload>;
    if (body.sortOrder !== undefined) {
        const n = Number(body.sortOrder);
        if (!Number.isFinite(n)) {
            return errorResponse('sortOrder must be a number', 400);
        }
        body.sortOrder = n;
    }
    const fields: (keyof UpdateMenuItemPayload)[] = [
        'parentId',
        'name',
        'link',
        'newTab',
        'authRequired',
        'description',
        'image',
        'tooltip',
        'sortOrder',
    ];
    for (const f of fields) {
        const v = body[f];
        if (v === undefined) continue;
        item.set(f, v);
    }
    await item.save();
    return jsonResponse(serializeItem(item), 200);
}

/** DELETE /api/menus/:id/items/:itemId */
export async function handleDeleteMenuItem(
    _request: Request,
    _env: MenuApiEnv,
    _menuId: string,
    itemId: string,
    appId: string | null,
): Promise<Response> {
    const item = (await MenuItem.find(itemId)) as InstanceType<typeof MenuItem> | null;
    if (!item) return errorResponse('Menu item not found', 404);
    const menu = (await Menu.find(item.get('menuId') as string)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);
    await item.destroy();
    return jsonResponse({ success: true }, 200);
}
