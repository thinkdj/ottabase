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
export { resolveBrandConfig, resolveFullBrandConfig } from './resolveBrandConfig';
export type { FullBrandConfig, ResolveBrandConfigEnv, ResolveBrandConfigOptions } from './resolveBrandConfig';
export {
    brandKitsTable,
    layoutRouteMappingsTable,
    layoutTemplatesTable,
    type BrandKitType,
    type LayoutRouteMappingType,
    type LayoutTemplateType,
    type NewBrandKitType,
    type NewLayoutRouteMappingType,
    type NewLayoutTemplateType,
} from './schema';
export type {
    BrandKitItem,
    BrandResolutionCache,
    LayoutMappingItem,
    LayoutTemplateItem,
    ResolvedBrandConfig,
    UpdateBrandKitPayload,
} from './types';
