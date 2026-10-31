/**
 * Menu API helpers – uses /api/brand/menus (cache-invalidating CRUD).
 */

import { api } from '@/lib/api';
import type { MediaLibraryItemLike } from '@ottabase/medialibrary';
import type { MenuItemDto, MenuRenderType, MenuWithItemsDto } from '@ottabase/ottamenu';

const BRAND_MENUS = '/api/brand/menus';

export const menuApi = {
    list: () => api<MenuWithItemsDto[]>(`${BRAND_MENUS}`),

    get: (id: string) => api<MenuWithItemsDto>(`${BRAND_MENUS}/${id}`),

    create: (body: { name: string; slug?: string; type?: MenuRenderType }) =>
        api<MenuWithItemsDto>(`${BRAND_MENUS}`, { method: 'POST', body }),

    update: (id: string, body: { name?: string; slug?: string; type?: MenuRenderType; isDefault?: boolean }) =>
        api<MenuWithItemsDto>(`${BRAND_MENUS}/${id}`, { method: 'PUT', body }),

    delete: (id: string) => api<{ success: boolean }>(`${BRAND_MENUS}/${id}`, { method: 'DELETE' }),

    createItem: (menuId: string, body: Partial<MenuItemDto>) =>
        api<MenuItemDto>(`${BRAND_MENUS}/${menuId}/items`, {
            method: 'POST',
            body: { ...body, menuId },
        }),

    updateItem: (menuId: string, itemId: string, body: Partial<MenuItemDto>) =>
        api<MenuItemDto>(`${BRAND_MENUS}/${menuId}/items/${itemId}`, {
            method: 'PUT',
            body,
        }),

    deleteItem: (menuId: string, itemId: string) =>
        api<{ success: boolean }>(`${BRAND_MENUS}/${menuId}/items/${itemId}`, { method: 'DELETE' }),

    /** Store an image in the media library (POST /api/files); the item keeps `storedFileOf(file)`, never a URL. */
    uploadImage: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'media');
        return api<{ success: boolean; file: MediaLibraryItemLike }>('/api/files', {
            method: 'POST',
            body: formData,
        });
    },
};
