// ---------------------------------------------------------------------------
// Brand Engine – Persistence layer exports
// ---------------------------------------------------------------------------

export {
    brandSettingsTable,
    layoutTemplatesTable,
    layoutRouteMappingsTable,
    themeVariantsTable,
    type BrandSettingsType,
    type NewBrandSettingsType,
    type LayoutTemplateType,
    type NewLayoutTemplateType,
    type LayoutRouteMappingType,
    type NewLayoutRouteMappingType,
    type ThemeVariantType,
    type NewThemeVariantType,
} from './schema';
export { BrandSettings, type RouteMappingRow } from './BrandSettings.model';
export { LayoutTemplate } from './LayoutTemplate.model';
export { LayoutRouteMapping } from './LayoutRouteMapping.model';
export { ThemeVariant } from './ThemeVariant.model';
export { createBrandCache } from './cache';
export type { BrandCacheClient } from './cache';
export { createBrandAssets } from './assets';
export type { BrandAssetClient, LogoType } from './assets';
export type {
    ResolvedBrandConfig,
    UpdateBrandPayload,
    BrandSettingsResponse,
    BrandPresetItem,
    BrandPresetCreatePayload,
    LayoutTemplateItem,
    LayoutMappingItem,
} from './types';
export { brandSettingsToConfig } from './brandSettingsToConfig';
export { resolveBrandConfig } from './resolveBrandConfig';
export type { ResolveBrandConfigEnv, ResolveBrandConfigOptions } from './resolveBrandConfig';
export { getLayoutData } from './layoutData';
export type { LayoutData } from './layoutData';
