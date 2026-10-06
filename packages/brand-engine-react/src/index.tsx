// ---------------------------------------------------------------------------
// @ottabase/brand-engine-react – Public API
// ---------------------------------------------------------------------------

export {
    BrandConfigProvider,
    BrandPathSync,
    BrandProvider,
    createRouteMatcher,
    resolveConfigForPath,
    useBrand,
} from './BrandProvider';
export type { BrandConfig, FullBrandConfig, ResolvedMenuSlotData, RouteMapping } from './BrandProvider';
export { LayoutResolver } from './LayoutResolver';
export type { LayoutComponentProps, LayoutResolverProps, RouterAdapter } from './LayoutResolver';
