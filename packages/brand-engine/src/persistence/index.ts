// ---------------------------------------------------------------------------
// Brand Engine – Persistence layer exports
// ---------------------------------------------------------------------------

export {
    brandKitsTable,
    layoutTemplatesTable,
    layoutRouteMappingsTable,
    type BrandKitType,
    type NewBrandKitType,
    type LayoutTemplateType,
    type NewLayoutTemplateType,
    type LayoutRouteMappingType,
    type NewLayoutRouteMappingType,
} from './schema';
export { BrandKit } from './BrandKit.model';
export { LayoutTemplate } from './LayoutTemplate.model';
export { LayoutRouteMapping } from './LayoutRouteMapping.model';
export { createBrandCache } from './cache';
export type { BrandCacheClient } from './cache';
export { createBrandAssets } from './assets';
export type { BrandAssetClient, LogoType } from './assets';
export type {
    ResolvedBrandConfig,
    UpdateBrandKitPayload,
    BrandKitItem,
    LayoutTemplateItem,
    LayoutMappingItem,
    BrandResolutionCache,
} from './types';
export { brandKitToTheme, brandKitLogos } from './brandKitToConfig';
export { resolveBrandConfig, resolveFullBrandConfig } from './resolveBrandConfig';
export type { ResolveBrandConfigEnv, ResolveBrandConfigOptions, FullBrandConfig } from './resolveBrandConfig';
export { getLayoutData } from './layoutData';
export type { LayoutData, RouteMappingRow } from './layoutData';
