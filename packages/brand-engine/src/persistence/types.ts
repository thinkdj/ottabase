// ---------------------------------------------------------------------------
// Brand Engine – Resolved config types (API response shape, KV cache)
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '../layout';
import type { ResolvedBrandTheme } from '../resolver';
import type { BrandTheme } from '../theme';

/** Resolved brand config (GET /api/brand). Path-scoped: theme + layout for current path. */
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
    themeBase: string;
    tenantTheme: Partial<BrandTheme>;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss?: string;
    hideOttabaseBranding: boolean;
    /** Resolved for current path */
    layoutTemplateId: string;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    /** All route mappings (path, layout, brandKit per row) */
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; brandKitId: string; priority: number }>;
}

/** Brand Kit list/detail item */
export interface BrandKitItem {
    id: string;
    organizationId: string | null;
    isDefault?: boolean;
    createdBy?: string | null;
    updatedBy?: string | null;
    name: string;
    slug?: string | null;
    brandName: string;
    tagline?: string | null;
    themePresetId?: string | null;
    tokensJson?: string | null;
    defaultColorScheme: string;
    allowDarkModeToggle: boolean;
    customCss?: string | null;
    hideOttabaseBranding: boolean;
    logoKey?: string | null;
    logoDarkKey?: string | null;
    iconKey?: string | null;
    ogImageKey?: string | null;
    emailLogoKey?: string | null;
    createdAt?: number;
    updatedAt?: number;
}

/** PUT /api/brand/kits/:id – update Brand Kit */
export interface UpdateBrandKitPayload {
    name?: string;
    slug?: string;
    brandName?: string;
    tagline?: string;
    tokensJson?: string | object;
    themePresetId?: string | null;
    defaultColorScheme?: 'light' | 'dark' | 'system';
    allowDarkModeToggle?: boolean;
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
    brandKitId: string;
    priority?: number;
}

/** Cached resolution data for KV */
export interface BrandResolutionCache {
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; brandKitId: string; priority: number }>;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    brandKitsMap: Record<
        string,
        {
            brandName: string;
            tagline?: string;
            logos: Record<string, string>;
            theme: ResolvedBrandTheme;
            themeBase: string;
            tenantTheme: Partial<BrandTheme>;
            defaultColorScheme: string;
            allowDarkModeToggle: boolean;
            customCss?: string;
            hideOttabaseBranding: boolean;
        }
    >;
}
