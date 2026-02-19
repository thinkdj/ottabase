// ---------------------------------------------------------------------------
// @ottabase/ottalayout – Layout System Types
//
// Canonical type definitions for the layout system.
// ---------------------------------------------------------------------------

// ── Variant enums ──────────────────────────────────────────────────────────

/** Header layout variants */
export type HeaderVariant = 'minimal' | 'sidebar' | 'topbar' | 'none';

/** Navigation placement */
export type NavigationVariant = 'sidebar' | 'topbar' | 'drawer' | 'none';

/**
 * Content width strategy.
 * Named sizes map to max-width utilities.
 */
export type ContentWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'fixed' | 'fluid';

/** UI density */
export type Density = 'compact' | 'comfy' | 'spacious';

/** Sidebar width variant */
export type SidebarWidth = 'narrow' | 'standard' | 'wide';

/** Container padding variant */
export type ContainerPadding = 'none' | 'sm' | 'md' | 'lg';

// ── Main config ────────────────────────────────────────────────────────────

/**
 * Layout configuration – stored per theme/tenant.
 * Treats layouts as configurable modules, decoupled from appearance tokens.
 * Optional fields receive sensible defaults via `mergeLayoutConfig()`.
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

    // ── Extended structural fields (optional) ──

    /** Whether header sticks to top on scroll (default: true for topbar) */
    headerSticky?: boolean;
    /** Sidebar width variant (default: 'standard') */
    sidebarWidth?: SidebarWidth;
    /** Whether sidebar can be collapsed (default: false) */
    sidebarCollapsible?: boolean;
    /** Sidebar position (default: 'left') */
    sidebarPosition?: 'left' | 'right';
    /** Horizontal padding for the main content container (default: 'md') */
    containerPadding?: ContainerPadding;
    /** Center content vertically – for auth / splash pages (default: false) */
    centerContent?: boolean;
}

// ── Defaults ───────────────────────────────────────────────────────────────

/** Default layout configuration */
export const DEFAULT_LAYOUT: LayoutConfig = {
    header: 'topbar',
    navigation: 'sidebar',
    contentWidth: 'lg',
    footer: true,
    density: 'comfy',
    headerSticky: true,
    sidebarWidth: 'standard',
    sidebarCollapsible: false,
    sidebarPosition: 'left',
    containerPadding: 'md',
    centerContent: false,
};

/** Defaults for optional fields — used by mergeLayoutConfig */
export const LAYOUT_FIELD_DEFAULTS: Required<
    Pick<
        LayoutConfig,
        | 'headerSticky'
        | 'sidebarWidth'
        | 'sidebarCollapsible'
        | 'sidebarPosition'
        | 'containerPadding'
        | 'centerContent'
    >
> = {
    headerSticky: true,
    sidebarWidth: 'standard',
    sidebarCollapsible: false,
    sidebarPosition: 'left',
    containerPadding: 'md',
    centerContent: false,
};

// ── Route mapping ──────────────────────────────────────────────────────────

/** A route mapping entry — maps a URL path pattern to a layout preset */
export interface RouteMapping {
    pathPattern: string;
    layoutTemplateId: string;
    priority: number;
}

/**
 * Minimal fallback route mappings. Apps should provide their own; this is a
 * safety net so routing always resolves.
 */
export function createDefaultRouteMappings(): RouteMapping[] {
    return [{ pathPattern: '/**', layoutTemplateId: 'app-shell', priority: 0 }];
}
