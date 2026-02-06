// ---------------------------------------------------------------------------
// BrandEngine – Layout System Types
// ---------------------------------------------------------------------------

/** Header layout variants */
export type HeaderVariant = 'minimal' | 'sidebar' | 'topbar' | 'none';

/** Navigation placement */
export type NavigationVariant = 'sidebar' | 'topbar' | 'drawer';

/** Content width strategy */
export type ContentWidth = 'fixed' | 'fluid' | 'full';

/** UI density */
export type Density = 'compact' | 'comfy';

/**
 * Layout configuration – stored per theme/tenant.
 * Treats layouts as configurable modules, decoupled from appearance tokens.
 */
export interface LayoutConfig {
    /** Header style */
    header: HeaderVariant;
    /** Primary navigation placement */
    navigation: NavigationVariant;
    /** Main content area width strategy */
    contentWidth: ContentWidth;
    /** Whether to show a footer */
    footer: boolean;
    /** UI density */
    density: Density;
}

/** Default layout configuration */
export const DEFAULT_LAYOUT: LayoutConfig = {
    header: 'topbar',
    navigation: 'sidebar',
    contentWidth: 'fluid',
    footer: true,
    density: 'comfy',
};
