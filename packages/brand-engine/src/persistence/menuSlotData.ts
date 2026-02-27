// ---------------------------------------------------------------------------
// Brand Engine – Load menu slot assignments with resolved menu data
//
// Fetches slot assignments for an app, then batch-loads referenced menus
// and items using brand-engine's own Menu/MenuItem models (no DI needed).
// ---------------------------------------------------------------------------

import type { MenuItemDto } from '@ottabase/ottamenu';
import { Menu } from './Menu.model';
import { MenuItem } from './MenuItem.model';
import { MenuSlotAssignment } from './MenuSlotAssignment.model';
import type { MenuSlotRenderType, ResolvedMenuSlot } from './types';

/**
 * Batch-fetch menus with their items by ID list.
 * Single query for menus, single query for all items, then group in memory.
 */
async function fetchMenusByIds(menuIds: string[]): Promise<ResolvedMenuSlot['menu'][]> {
    if (menuIds.length === 0) return [];

    // Single query: fetch all menus by id
    const menuRows = (await Menu.where({ id: menuIds }, { orderBy: 'name', orderDirection: 'asc' })) as InstanceType<
        typeof Menu
    >[];

    if (menuRows.length === 0) return [];

    // Single query: fetch all items for these menus
    const allItems = (await MenuItem.where(
        { menuId: menuIds },
        { orderBy: 'sortOrder', orderDirection: 'asc' },
    )) as InstanceType<typeof MenuItem>[];

    const itemsByMenuId = new Map<string, InstanceType<typeof MenuItem>[]>();
    for (const item of allItems) {
        const mid = item.get('menuId') as string;
        const arr = itemsByMenuId.get(mid) ?? [];
        arr.push(item);
        itemsByMenuId.set(mid, arr);
    }

    return menuRows.map((menu) => {
        const menuId = menu.get('id') as string;
        const items = itemsByMenuId.get(menuId) ?? [];
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
            id: menuId,
            appId: (menu.get('appId') as string | null) ?? null,
            name: menu.get('name') as string,
            slug: menu.get('slug') as string,
            type: (menu.get('type') as string) || 'sidebar',
            items: itemDtos,
        };
    });
}

/**
 * Load all menu slot assignments for an app with resolved menu data.
 * Returns a map of slot name → array of resolved menu slots.
 */
export async function getMenuSlotData(appId: string | null): Promise<Record<string, ResolvedMenuSlot[]>> {
    // 1. Get all slot assignments for this app (fall back to system defaults)
    let assignments = (await MenuSlotAssignment.where(
        { appId },
        { orderBy: 'sortOrder', orderDirection: 'asc' },
    )) as InstanceType<typeof MenuSlotAssignment>[];

    // Fall back to system default slots (appId=null) when no app-specific ones exist
    if (assignments.length === 0 && appId !== null) {
        assignments = (await MenuSlotAssignment.where(
            { appId: null },
            { orderBy: 'sortOrder', orderDirection: 'asc' },
        )) as InstanceType<typeof MenuSlotAssignment>[];
    }

    if (assignments.length === 0) return {};

    // 2. Collect unique menuIds and fetch all menus + items in one batch
    const menuIds = [...new Set(assignments.map((a) => a.get('menuId') as string))];
    const menus = await fetchMenusByIds(menuIds);
    const menusById = new Map(menus.map((m) => [m.id, m]));

    // 3. Build the result grouped by slot name
    const result: Record<string, ResolvedMenuSlot[]> = {};

    for (const assignment of assignments) {
        const slotName = assignment.get('slotName') as string;
        const menuId = assignment.get('menuId') as string;
        const renderType = ((assignment.get('renderType') as string) || 'sidebar') as MenuSlotRenderType;
        const sortOrder = (assignment.get('sortOrder') as number) ?? 0;
        const menu = menusById.get(menuId);

        if (!menu) continue; // Skip orphaned assignments

        const slot: ResolvedMenuSlot = {
            slotName,
            menuId,
            renderType,
            sortOrder,
            menu,
        };

        if (!result[slotName]) result[slotName] = [];
        result[slotName].push(slot);
    }

    return result;
}
