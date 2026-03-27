// ---------------------------------------------------------------------------
// Brand Engine – Menu CRUD API handlers (wired under /api/brand/menus)
// GET /api/brand/menus (list), GET /api/brand/menus/slug/:slug (by slug with items)
// POST /api/brand/menus, PUT /api/brand/menus/:id, DELETE /api/brand/menus/:id
// POST /api/brand/menus/:id/items, PUT /api/brand/menus/:id/items/:itemId, DELETE /api/brand/menus/:id/items/:itemId
// All mutations call warmBrandCache (menus are part of brand API response).
// Max 100 items per menu enforced to keep KV cache and DOM rendering performant.
// ---------------------------------------------------------------------------

const MAX_ITEMS_PER_MENU = 100;

import type { MenuItemDto } from '@ottabase/ottamenu';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { Menu } from '../persistence/Menu.model';
import { MenuItem } from '../persistence/MenuItem.model';
import { getMenuBySlug } from '../persistence/menuData';
import type { CreateMenuItemPayload, MenuWithItemsDto, UpdateMenuItemPayload } from '../persistence/types';
import type { BrandApiEnv } from './brand-api';
import { warmBrandCache } from './warm-cache';

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

/** GET /api/brand/menus – List menus for app (batch-loads all items to avoid N+1) */
export async function handleGetMenus(_request: Request, _env: BrandApiEnv, appId: string | null): Promise<Response> {
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

/** GET /api/brand/menus/slug/:slug – Get menu by slug with items */
export async function handleGetMenuBySlug(
    _request: Request,
    _env: BrandApiEnv,
    slug: string,
    appId: string | null,
): Promise<Response> {
    const menu = await getMenuBySlug(slug, appId);
    if (!menu) return errorResponse('Menu not found', 404);
    return jsonResponse(menu, 200);
}

/** GET /api/brand/menus/:id – Get one menu with items */
export async function handleGetMenu(
    _request: Request,
    _env: BrandApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const menu = (await Menu.find(id)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);
    return jsonResponse(await menuWithItems(menu), 200);
}

/** POST /api/brand/menus – Create menu */
export async function handleCreateMenu(request: Request, env: BrandApiEnv, appId: string | null): Promise<Response> {
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
    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse(await menuWithItems(menu), 201);
}

/** PUT /api/brand/menus/:id – Update menu */
export async function handleUpdateMenu(
    request: Request,
    env: BrandApiEnv,
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
    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse(await menuWithItems(menu), 200);
}

/** DELETE /api/brand/menus/:id */
export async function handleDeleteMenu(
    _request: Request,
    env: BrandApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const menu = (await Menu.find(id)) as InstanceType<typeof Menu> | null;
    if (!menu) return errorResponse('Menu not found', 404);
    const mApp = menu.get('appId') as string | null;
    if (mApp !== null && appId !== mApp) return errorResponse('Menu not found', 404);
    await menu.destroy();
    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse({ success: true }, 200);
}

/** POST /api/brand/menus/:id/items – Create menu item */
export async function handleCreateMenuItem(
    request: Request,
    env: BrandApiEnv,
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

    const existingCount = (await MenuItem.where({ menuId })) as InstanceType<typeof MenuItem>[];
    if (existingCount.length >= MAX_ITEMS_PER_MENU) {
        return errorResponse(`Menu cannot have more than ${MAX_ITEMS_PER_MENU} items`, 400);
    }
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
    await warmBrandCache(env, { appId: itemAppId ?? null });
    return jsonResponse(serializeItem(item), 201);
}

/** PUT /api/brand/menus/:id/items/:itemId – Update menu item */
export async function handleUpdateMenuItem(
    request: Request,
    env: BrandApiEnv,
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
    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse(serializeItem(item), 200);
}

/** DELETE /api/brand/menus/:id/items/:itemId */
export async function handleDeleteMenuItem(
    _request: Request,
    env: BrandApiEnv,
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
    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse({ success: true }, 200);
}
