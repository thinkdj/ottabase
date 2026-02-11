// ---------------------------------------------------------------------------
// Brand Engine – Persistence layer exports
// ---------------------------------------------------------------------------

export {
    brandSettingsTable,
    layoutTemplatesTable,
    layoutRouteMappingsTable,
    themeVariantsTable,
    brandBoxesTable,
    type BrandSettingsType,
    type NewBrandSettingsType,
    type LayoutTemplateType,
    type NewLayoutTemplateType,
    type LayoutRouteMappingType,
    type NewLayoutRouteMappingType,
    type ThemeVariantType,
    type NewThemeVariantType,
    type BrandBoxType,
    type NewBrandBoxType,
} from './schema';
export { BrandSettings } from './BrandSettings.model';
export { LayoutTemplate } from './LayoutTemplate.model';
export { LayoutRouteMapping } from './LayoutRouteMapping.model';
export { ThemeVariant } from './ThemeVariant.model';
export { BrandBox } from './BrandBox.model';
export { createBrandCache } from './cache';
export type { BrandCacheClient } from './cache';
export { createBrandAssets } from './assets';
export type { BrandAssetClient, LogoType } from './assets';
export type { ResolvedBrandConfig } from './types';
export { brandSettingsToConfig } from './brandSettingsToConfig';
export { resolveBrandConfig } from './resolveBrandConfig';
export type { ResolveBrandConfigEnv, ResolveBrandConfigOptions } from './resolveBrandConfig';
export { getLayoutData } from './layoutData';
export type { LayoutData } from './layoutData';
