// ---------------------------------------------------------------------------
// @ottabase/ottamenu – Shared types
//
// Pure type definitions for menu items and menus. No ORM, no persistence.
// Used by renderers (in this package) and by brand-engine (for persistence).
// ---------------------------------------------------------------------------

/** Menu item shape (API + renderer). Flat list; build tree via parentId. */
export interface MenuItemDto {
    id: string;
    menuId: string;
    /** Parent item id for nesting; null/undefined = top-level */
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

/** Default render type for menu (used by renderMenu when no override) */
export type MenuRenderType = 'sidebar' | 'flyout' | 'mega' | 'navbar' | 'dropdown' | 'footer';

/** Menu with items (API response shape) */
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
