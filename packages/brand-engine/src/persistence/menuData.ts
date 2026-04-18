// ---------------------------------------------------------------------------
// Brand Engine – Resolve menu by slug for app
// Returns menu with items sorted by sortOrder, or null if none found.
// ---------------------------------------------------------------------------

import type { MenuItemDto, MenuRenderType } from '@ottabase/ottamenu';
import { Menu } from './Menu.model';
import { MenuItem } from './MenuItem.model';

/**
 * Get menu with items by slug for app.
 * Returns null when no menu exists (caller falls back to static nav links).
 */
export async function getMenuBySlug(
    slug: string,
    appId: string | null,
): Promise<{ id: string; name: string; slug: string; type: MenuRenderType; items: MenuItemDto[] } | null> {
    const menu = (await Menu.first({
        appId: appId ?? null,
        slug,
    })) as InstanceType<typeof Menu> | null;

    if (!menu) return null;

    const items = (await MenuItem.where(
        { menuId: menu.get('id') as string },
        { orderBy: 'sortOrder', orderDirection: 'asc' },
    )) as InstanceType<typeof MenuItem>[];

    const itemDtos: MenuItemDto[] = items.map((item) => ({
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
    }));

    return {
        id: menu.get('id') as string,
        name: menu.get('name') as string,
        slug: menu.get('slug') as string,
        type: ((menu.get('type') as string) || 'sidebar') as MenuRenderType,
        items: itemDtos,
    };
}
