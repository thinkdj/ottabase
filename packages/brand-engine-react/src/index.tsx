// ---------------------------------------------------------------------------
// @ottabase/brand-engine-react – Public API
// ---------------------------------------------------------------------------

export { BrandPathSync, BrandProvider, useBrand } from './BrandProvider';
export type { BrandConfig, FullBrandConfig } from './BrandProvider';
export { LayoutResolver } from './LayoutResolver';
export type { LayoutResolverProps, RouterAdapter } from './LayoutResolver';
export { getLayoutComponent, registerLayoutComponent } from './registry';
export type { LayoutComponentProps } from './registry';
