// ---------------------------------------------------------------------------
// Ottamenu – Persistence layer exports
// ---------------------------------------------------------------------------

export { getMenuBySlug } from './menuData';
export { Menu } from './Menu.model';
export { MenuItem } from './MenuItem.model';
export {
    menusTable,
    menuItemsTable,
    type MenuType,
    type MenuItemType,
    type NewMenuType,
    type NewMenuItemType,
} from './schema';
export type {
    CreateMenuPayload,
    CreateMenuItemPayload,
    MenuItemDto,
    MenuRenderType,
    MenuWithItemsDto,
    UpdateMenuPayload,
    UpdateMenuItemPayload,
} from './types';
export { buildItemTree } from './treeUtils';
export type { MenuItemTreeNode } from './treeUtils';
