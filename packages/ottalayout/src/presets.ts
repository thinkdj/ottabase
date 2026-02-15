// ---------------------------------------------------------------------------
// @ottabase/ottalayout – Built-in Layout Presets
//
// Presets are LayoutConfig variations rendered by the same configurable layout
// component. They are NOT different React components – the same layout component
// receives different LayoutConfig values via the layoutComponent prop on
// <LayoutResolver>.
// ---------------------------------------------------------------------------

import type { LayoutConfig } from './types';

/**
 * Identifier for a built-in layout preset.
 * Apps can extend with custom string IDs; these are the shipped defaults.
 */
export type LayoutPresetId =
    | 'homepage'
    | 'app-shell'
    | 'docs'
    | 'minimal'
    | 'auth'
    | 'landing'
    | 'dashboard'
    | 'settings'
    | 'marketing'
    | 'fullscreen';

/** A preset is a named LayoutConfig. */
export interface LayoutPreset {
    config: LayoutConfig;
}

// ── Preset definitions ─────────────────────────────────────────────────────

/** Blog / marketing homepage – minimal header, full-width, topbar nav */
export const HOMEPAGE_LAYOUT: LayoutPreset = {
    config: {
        header: 'minimal',
        navigation: 'topbar',
        contentWidth: 'full',
        footer: true,
        density: 'comfy',
        headerSticky: false,
    },
};

/** Standard application shell – topbar + sidebar, fluid width */
export const APP_SHELL_LAYOUT: LayoutPreset = {
    config: {
        header: 'topbar',
        navigation: 'sidebar',
        contentWidth: 'lg',
        footer: false,
        density: 'comfy',
        headerSticky: true,
        sidebarWidth: 'standard',
        sidebarCollapsible: true,
        sidebarPosition: 'left',
    },
};

/** Documentation layout – narrow sidebar, fixed-width content */
export const DOCS_LAYOUT: LayoutPreset = {
    config: {
        header: 'topbar',
        navigation: 'sidebar',
        contentWidth: 'md',
        footer: true,
        density: 'compact',
        headerSticky: true,
        sidebarWidth: 'narrow',
        sidebarCollapsible: false,
        sidebarPosition: 'left',
    },
};

/** Minimal – no chrome, full width (embeds, iframes, custom pages) */
export const MINIMAL_LAYOUT: LayoutPreset = {
    config: {
        header: 'none',
        navigation: 'none',
        contentWidth: 'full',
        footer: false,
        density: 'comfy',
    },
};

/** Auth pages – minimal header, centered narrow content, no nav */
export const AUTH_LAYOUT: LayoutPreset = {
    config: {
        header: 'minimal',
        navigation: 'none',
        contentWidth: 'xs',
        footer: false,
        density: 'comfy',
        headerSticky: false,
        centerContent: true,
        containerPadding: 'md',
    },
};

/** Landing page – full-width, spacious, topbar nav, prominent footer */
export const LANDING_LAYOUT: LayoutPreset = {
    config: {
        header: 'topbar',
        navigation: 'topbar',
        contentWidth: 'full',
        footer: true,
        density: 'spacious',
        headerSticky: false,
    },
};

/** Data-dense dashboard – compact, wide content, collapsible thin sidebar */
export const DASHBOARD_LAYOUT: LayoutPreset = {
    config: {
        header: 'topbar',
        navigation: 'sidebar',
        contentWidth: 'xl',
        footer: false,
        density: 'compact',
        headerSticky: true,
        sidebarWidth: 'narrow',
        sidebarCollapsible: true,
        sidebarPosition: 'left',
        containerPadding: 'sm',
    },
};

/** Settings / account pages – sidebar nav, medium-width content */
export const SETTINGS_LAYOUT: LayoutPreset = {
    config: {
        header: 'topbar',
        navigation: 'sidebar',
        contentWidth: 'md',
        footer: false,
        density: 'comfy',
        headerSticky: true,
        sidebarWidth: 'narrow',
        sidebarCollapsible: false,
        sidebarPosition: 'left',
    },
};

/** Marketing pages – topbar nav, standard width, sticky header */
export const MARKETING_LAYOUT: LayoutPreset = {
    config: {
        header: 'topbar',
        navigation: 'topbar',
        contentWidth: 'lg',
        footer: true,
        density: 'comfy',
        headerSticky: true,
    },
};

/** Fullscreen / immersive – no chrome at all, edge-to-edge */
export const FULLSCREEN_LAYOUT: LayoutPreset = {
    config: {
        header: 'none',
        navigation: 'none',
        contentWidth: 'full',
        footer: false,
        density: 'comfy',
        containerPadding: 'none',
    },
};

// ── Preset map ─────────────────────────────────────────────────────────────

export const LAYOUT_PRESETS: Record<LayoutPresetId, LayoutPreset> = {
    homepage: HOMEPAGE_LAYOUT,
    'app-shell': APP_SHELL_LAYOUT,
    docs: DOCS_LAYOUT,
    minimal: MINIMAL_LAYOUT,
    auth: AUTH_LAYOUT,
    landing: LANDING_LAYOUT,
    dashboard: DASHBOARD_LAYOUT,
    settings: SETTINGS_LAYOUT,
    marketing: MARKETING_LAYOUT,
    fullscreen: FULLSCREEN_LAYOUT,
};

/** All built-in preset IDs */
export const LAYOUT_PRESET_IDS: LayoutPresetId[] = Object.keys(LAYOUT_PRESETS) as LayoutPresetId[];
