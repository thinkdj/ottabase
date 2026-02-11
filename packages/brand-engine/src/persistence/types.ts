// ---------------------------------------------------------------------------
// Brand Engine – Resolved config types (API response shape, KV cache)
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '../layout';
import type { ResolvedBrandTheme } from '../resolver';

/** Resolved brand config (GET /api/brand). Same as BrandConfigResponse. */
export interface ResolvedBrandConfig {
    brandName: string;
    tagline?: string;
    logos: {
        primary?: string;
        dark?: string;
        icon?: string;
        ogImage?: string;
        emailLogo?: string;
    };
    theme: ResolvedBrandTheme;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss?: string;
    hideOttabaseBranding: boolean;
    /** Route path patterns → layout template ID (empty for Task 01) */
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }>;
    /** Map layoutTemplateId → { componentKey, config } */
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
}

/** PUT /api/brand – update brand settings */
export interface UpdateBrandPayload {
    brandName?: string;
    tagline?: string;
    tokensJson?: string | object;
    layoutJson?: string | object;
    defaultColorScheme?: 'light' | 'dark' | 'system';
    allowDarkModeToggle?: boolean;
    customCss?: string;
    hideOttabaseBranding?: boolean;
}

/** GET /api/brand/settings – raw settings for admin */
export interface BrandSettingsResponse {
    brandName: string;
    tagline?: string;
    tokensJson: string;
    layoutJson: string;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss: string;
    hideOttabaseBranding: boolean;
}

/** Preset list item (GET /api/brand/presets) */
export interface BrandPresetItem {
    id: string;
    name: string;
    slug?: string | null;
    isActive?: boolean;
    brandName?: string;
    tagline?: string | null;
    tokensJson?: string | null;
    themeVariantId?: string | null;
    routeMappingsJson?: string | null;
    layoutTemplatesSnapshotJson?: string | null;
    customCss?: string | null;
    hideOttabaseBranding?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** POST /api/brand/presets – create preset */
export interface BrandPresetCreatePayload {
    name: string;
    slug?: string;
    snapshotFromCurrent?: boolean;
    brandName?: string;
    tagline?: string;
    tokensJson?: string | object;
    themeVariantId?: string;
    routeMappingsJson?: string | object;
    layoutTemplatesSnapshotJson?: string | object;
    customCss?: string;
    hideOttabaseBranding?: boolean;
}

/** GET /api/brand/layouts – layout template item */
export interface LayoutTemplateItem {
    id: string;
    name: string;
    componentKey: string;
    config?: object;
}

/** GET /api/brand/mappings – route mapping item */
export interface LayoutMappingItem {
    id?: string;
    pathPattern: string;
    layoutTemplateId: string;
    priority?: number;
}
