// ---------------------------------------------------------------------------
// Brand Engine – Persistence layer exports
// ---------------------------------------------------------------------------

export {
    brandSettingsTable,
    layoutTemplatesTable,
    layoutRouteMappingsTable,
    type BrandSettingsType,
    type NewBrandSettingsType,
    type LayoutTemplateType,
    type NewLayoutTemplateType,
    type LayoutRouteMappingType,
    type NewLayoutRouteMappingType,
} from './schema';
export { BrandSettings } from './BrandSettings.model';
export { LayoutTemplate } from './LayoutTemplate.model';
export { LayoutRouteMapping } from './LayoutRouteMapping.model';
export { createBrandCache } from './cache';
export type { BrandCacheClient } from './cache';
export { createBrandAssets } from './assets';
export type { BrandAssetClient, LogoType } from './assets';
export type { ResolvedBrandConfig } from './types';
export { brandSettingsToConfig } from './brandSettingsToConfig';
export { getLayoutData } from './layoutData';
export type { LayoutData } from './layoutData';
