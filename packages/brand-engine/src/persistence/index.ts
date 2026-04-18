// ---------------------------------------------------------------------------
// Brand Engine – Persistence layer exports
// ---------------------------------------------------------------------------

export { createBrandAssets } from './assets';
export type { BrandAssetClient, LogoType } from './assets';
export { BrandKit } from './BrandKit.model';
export { brandKitLogos, brandKitToTheme, resolveInheritanceChain } from './brandKitToConfig';
export { createBrandCache } from './cache';
export type { BrandCacheClient } from './cache';
export { getLayoutData } from './layoutData';
export type { LayoutData, RouteMappingRow } from './layoutData';
export { LayoutRouteMapping } from './LayoutRouteMapping.model';
export { LayoutTemplate } from './LayoutTemplate.model';
export { Menu } from './Menu.model';
export { brandEngineMigrations } from './migrations';
export { getMenuBySlug } from './menuData';
export { MenuItem } from './MenuItem.model';
export { MenuSlotAssignment } from './MenuSlotAssignment.model';
export { getMenuSlotData } from './menuSlotData';
export { resolveBrandConfig, resolveFullBrandConfig } from './resolveBrandConfig';
export type { FullBrandConfig, ResolveBrandConfigEnv, ResolveBrandConfigOptions } from './resolveBrandConfig';
export {
    brandKitsTable,
    layoutRouteMappingsTable,
    layoutTemplatesTable,
    menuItemsTable,
    menuSlotAssignmentsTable,
    menusTable,
    type BrandKitType,
    type LayoutRouteMappingType,
    type LayoutTemplateType,
    type MenuItemType,
    type MenuSlotAssignmentType,
    type MenuType,
    type NewBrandKitType,
    type NewLayoutRouteMappingType,
    type NewLayoutTemplateType,
    type NewMenuItemType,
    type NewMenuSlotAssignmentType,
    type NewMenuType,
} from './schema';
export type {
    BrandKitItem,
    BrandResolutionCache,
    CreateMenuItemPayload,
    CreateMenuPayload,
    LayoutMappingItem,
    LayoutTemplateItem,
    MenuSlotAssignmentItem,
    MenuSlotRenderType,
    MenuWithItemsDto,
    ResolvedBrandConfig,
    ResolvedMenuSlot,
    UpdateBrandKitPayload,
    UpdateMenuItemPayload,
    UpdateMenuPayload,
} from './types';
