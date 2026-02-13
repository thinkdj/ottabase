// ---------------------------------------------------------------------------
// Brand Engine – Layout system exports (pure logic, no React)
// ---------------------------------------------------------------------------

export { DEFAULT_ROUTE_MAPPINGS } from './defaults';
export { APP_SHELL_LAYOUT, DOCS_LAYOUT, HOMEPAGE_LAYOUT, LAYOUT_PRESETS, MINIMAL_LAYOUT } from './presets';
export type { LayoutComponentKey, LayoutPreset } from './presets';
export { pathPatternToRegex, resolveLayoutForPath } from './resolver';
