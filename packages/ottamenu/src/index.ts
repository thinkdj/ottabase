// ---------------------------------------------------------------------------
// Ottamenu – Pure menu types, renderers, and tree utilities
// No persistence or ORM – models/schema/handlers live in @ottabase/brand-engine
// ---------------------------------------------------------------------------

// Pure types (shared contract between renderers and persistence layer)
export type { MenuItemDto, MenuRenderType, MenuWithItemsDto } from './types';

// Tree utilities (pure functions, no DB dependency)
export { buildItemTree } from './treeUtils';
export type { MenuItemTreeNode } from './treeUtils';

// React renderers + components
export {
    DropdownMenuRenderer,
    FlyoutMenuRenderer,
    FooterMenuRenderer,
    MegaMenuRenderer,
    MenuItemLink,
    MenuRenderer,
    MenuSlotRenderer,
    NavbarMenuRenderer,
    SidebarMenuRenderer,
    renderMenu,
} from './render';
export type { MenuForRender, RenderMenuOptions, ResolvedMenuSlotData } from './render';
