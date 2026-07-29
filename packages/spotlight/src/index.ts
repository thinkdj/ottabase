// ====================================================================
// @ottabase/spotlight — Root (100% PURE, no rendered UI)
// --------------------------------------------------------------------
// DEPENDENCY-FREE of any UI package by contract: the context, hooks and
// API helpers exported here import no @ottabase/ui-shadcn, no Radix and
// no icon library. The rendered components (Spotlight, SpotlightProvider)
// live behind the isolated '@ottabase/spotlight/react' subpath.
//
// Import map:
//   @ottabase/spotlight         SpotlightContext, useSpotlight, useSpotlightSearch,
//                               createApiSearchHandler(+WithSignal), all types
//   @ottabase/spotlight/react   Spotlight, SpotlightProvider (rendered UI)
// ====================================================================

export { SpotlightContext, useSpotlightContext as useSpotlight } from './context';
export type { SpotlightConfig, SpotlightContextValue, SpotlightProps, SpotlightResult } from './types';
export { useSpotlightSearch } from './useSpotlightSearch';
export type { UseSpotlightSearchOptions, UseSpotlightSearchReturn } from './useSpotlightSearch';
export { createApiSearchHandler, createApiSearchHandlerWithSignal } from './utils/api-helpers';
export type { CreateApiSearchHandlerOptions } from './utils/api-helpers';
