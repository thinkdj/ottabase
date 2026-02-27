/**
 * Menu API helpers – uses OttaORM CRUD endpoints where possible.
 * Public sidebar stays custom (GET /api/menus/sidebar).
 */

import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api-types';

const BASE = '/api/menus';
const OTTORM = '/api/ottaorm';

export interface MenuItemDto {
    id: string;
    menuId: string;
    parentId?: string | null;
    name: string;
    link: string;
    newTab?: boolean;
    authRequired?: boolean;
    description?: string | null;
    image?: string | null;
    tooltip?: string | null;
    sortOrder?: number;
}

export type MenuRenderType = 'sidebar' | 'flyout' | 'mega' | 'navbar' | 'dropdown' | 'footer';

export interface MenuWithItemsDto {
    id: string;
    appId: string | null;
    name: string;
    slug: string;
    type: MenuRenderType;
    isDefault?: boolean;
    items: MenuItemDto[];
    createdAt?: number;
    updatedAt?: number;
}

/** Raw menu/item from OttaORM (camelCase) */
interface MenuRecord {
    id: string;
    appId: string | null;
    name: string;
    slug: string;
    type: string;
    isDefault?: boolean;
    createdAt?: number;
    updatedAt?: number;
}

interface MenuItemRecord {
    id: string;
    menuId: string;
    parentId?: string | null;
    appId?: string | null;
    name: string;
    link: string;
    newTab?: boolean;
    authRequired?: boolean;
    description?: string | null;
    image?: string | null;
    tooltip?: string | null;
    sortOrder?: number;
    createdAt?: number;
    updatedAt?: number;
}

/** Public: GET /api/menus/sidebar – resolved sidebar for SidebarNav */
export const menuSidebarApi = {
    get: () => api<MenuWithItemsDto | null>(`${BASE}/sidebar`),
};

/** Serialize item record to DTO (drop appId for API shape) */
function toItemDto(r: MenuItemRecord): MenuItemDto {
    return {
        id: r.id,
        menuId: r.menuId,
        parentId: r.parentId ?? null,
        name: r.name,
        link: r.link,
        newTab: r.newTab ?? false,
        authRequired: r.authRequired ?? false,
        description: r.description ?? null,
        image: r.image ?? null,
        tooltip: r.tooltip ?? null,
        sortOrder: r.sortOrder ?? 0,
    };
}

/** Compose menu + items into MenuWithItemsDto */
function toMenuWithItems(menu: MenuRecord, items: MenuItemRecord[]): MenuWithItemsDto {
    return {
        id: menu.id,
        appId: menu.appId ?? null,
        name: menu.name,
        slug: menu.slug,
        type: (menu.type || 'sidebar') as MenuRenderType,
        isDefault: menu.isDefault ?? true,
        items: items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(toItemDto),
        createdAt: menu.createdAt,
        updatedAt: menu.updatedAt,
    };
}

export const menuApi = {
    list: async (): Promise<MenuWithItemsDto[]> => {
        const res = await api<PaginatedResponse<MenuRecord>>(`${OTTORM}/menus`);
        const menus = res.data ?? [];
        if (menus.length === 0) return [];

        const menuIds = menus.map((m) => m.id);
        const itemsRes = await api<PaginatedResponse<MenuItemRecord>>(
            `${OTTORM}/menu_items?where=${encodeURIComponent(JSON.stringify({ menuId: menuIds }))}`,
        );
        const allItems = itemsRes.data ?? [];
        const byMenu = new Map<string, MenuItemRecord[]>();
        for (const it of allItems) {
            const arr = byMenu.get(it.menuId) ?? [];
            arr.push(it);
            byMenu.set(it.menuId, arr);
        }

        return menus.map((m) => toMenuWithItems(m, byMenu.get(m.id) ?? []));
    },

    get: async (id: string): Promise<MenuWithItemsDto> => {
        const [menuRes, itemsRes] = await Promise.all([
            api<MenuRecord>(`${OTTORM}/menus/${id}`),
            api<PaginatedResponse<MenuItemRecord>>(
                `${OTTORM}/menu_items?where=${encodeURIComponent(JSON.stringify({ menuId: id }))}`,
            ),
        ]);
        const items = (itemsRes as PaginatedResponse<MenuItemRecord>).data ?? [];
        return toMenuWithItems(menuRes, items);
    },

    create: (body: { name: string; slug?: string; type?: MenuRenderType }) =>
        api<MenuRecord>(`${OTTORM}/menus`, { method: 'POST', body }).then((m) => menuApi.get(m.id)),

    update: (id: string, body: { name?: string; slug?: string; type?: MenuRenderType; isDefault?: boolean }) =>
        api<MenuRecord>(`${OTTORM}/menus/${id}`, { method: 'PATCH', body }).then((m) => menuApi.get(m.id)),

    delete: (id: string) => api<{ success: boolean }>(`${OTTORM}/menus/${id}`, { method: 'DELETE' }),

    createItem: (menuId: string, body: Partial<MenuItemDto>) =>
        api<MenuItemRecord>(`${OTTORM}/menu_items`, {
            method: 'POST',
            body: { ...body, menuId },
        }).then(toItemDto),

    updateItem: (menuId: string, itemId: string, body: Partial<MenuItemDto>) =>
        api<MenuItemRecord>(`${OTTORM}/menu_items/${itemId}`, {
            method: 'PATCH',
            body,
        }).then(toItemDto),

    deleteItem: (menuId: string, itemId: string) =>
        api<{ success: boolean }>(`${OTTORM}/menu_items/${itemId}`, { method: 'DELETE' }),

    /** Upload an image to R2 via the generic /api/upload endpoint */
    uploadImage: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api<{ success: boolean; url: string; key: string; provider: string }>('/api/upload', {
            method: 'POST',
            body: formData,
        });
    },
};
