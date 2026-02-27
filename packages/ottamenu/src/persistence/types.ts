// ---------------------------------------------------------------------------
// Menu Manager – API types
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

/** Menu with items (API list/detail) */
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

/** Create/update menu payload */
export interface CreateMenuPayload {
    name: string;
    slug: string;
    type?: MenuRenderType;
    isDefault?: boolean;
}

export interface UpdateMenuPayload {
    name?: string;
    slug?: string;
    type?: MenuRenderType;
    isDefault?: boolean;
}

/** Create/update menu item payload */
export interface CreateMenuItemPayload {
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

export interface UpdateMenuItemPayload {
    parentId?: string | null;
    name?: string;
    link?: string;
    newTab?: boolean;
    authRequired?: boolean;
    description?: string | null;
    image?: string | null;
    tooltip?: string | null;
    sortOrder?: number;
}
