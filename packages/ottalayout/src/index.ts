// ---------------------------------------------------------------------------
// @ottabase/ottalayout – Public API (pure logic, no React)
//
// This entrypoint exports types, presets, resolver, validators, and utilities.
// For React-specific features (slots, useLayoutMeta), import from
// '@ottabase/ottalayout/react'.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────
export { BUILT_IN_MENU_SLOTS, DEFAULT_LAYOUT, LAYOUT_FIELD_DEFAULTS, createDefaultRouteMappings } from './types';
export type {
    BuiltInMenuSlotName,
    ContainerPadding,
    ContentWidth,
    Density,
    HeaderVariant,
    LayoutConfig,
    MenuSlotConfig,
    NavigationVariant,
    RouteMapping,
    SidebarWidth,
} from './types';

// ── Presets ────────────────────────────────────────────────────────────────
export {
    APP_SHELL_LAYOUT,
    AUTH_LAYOUT,
    DASHBOARD_LAYOUT,
    DOCS_LAYOUT,
    FULLSCREEN_LAYOUT,
    HOMEPAGE_LAYOUT,
    LANDING_LAYOUT,
    LAYOUT_PRESETS,
    LAYOUT_PRESET_IDS,
    MARKETING_LAYOUT,
    MINIMAL_LAYOUT,
    SETTINGS_LAYOUT,
} from './presets';
export type { LayoutPreset, LayoutPresetId } from './presets';

// ── Resolver ───────────────────────────────────────────────────────────────
export { pathPatternToRegex, resolveLayoutForPath, resolveRouteForPath } from './resolver';
export type { RouteMatchResult } from './resolver';

// ── Validators ─────────────────────────────────────────────────────────────
export {
    VALID_CONTAINER_PADDINGS,
    VALID_DENSITIES,
    VALID_HEADERS,
    VALID_NAVIGATIONS,
    VALID_SIDEBAR_POSITIONS,
    VALID_SIDEBAR_WIDTHS,
    VALID_WIDTHS,
    isValidLayoutConfig,
    isValidPathPattern,
    mergeLayoutConfig,
} from './validators';

// ── Utilities ──────────────────────────────────────────────────────────────
export { containerPaddingClass, contentWidthClass, densityPadding, sidebarWidthClass } from './utils';
