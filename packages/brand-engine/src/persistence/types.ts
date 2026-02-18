// ---------------------------------------------------------------------------
// Brand Engine – Resolved config types (API response shape, KV cache)
// v2: Per-app scoping – no organizationId references
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import type { ResolvedBrandTheme } from '../resolver';

/** Resolved brand config (GET /api/brand). Path-scoped: theme + layout for current path. Per-app. */
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
    /** Resolved for current path */
    layoutTemplateId: string;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    /** All route mappings (path, layout, brandKit per row) */
    routeMappings: Array<{
        pathPattern: string;
        layoutTemplateId: string;
        brandKitId: string;
        priority: number;
        tokenOverridesJson?: string | null;
    }>;
}

/** Brand Kit list/detail item */
export interface BrandKitItem {
    id: string;
    appId: string | null;
    isDefault?: boolean;
    /** Parent Brand Kit ID – child inherits tokens/settings, overrides selectively */
    parentBrandKitId?: string | null;
    /** Resolved parent name (populated by list API for display) */
    parentBrandKitName?: string | null;
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
    parentBrandKitId?: string | null;
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
    /** Optional per-route token overrides (partial DesignTokens JSON) */
    tokenOverridesJson?: string | null;
}

/** Cached resolution data for KV */
export interface BrandResolutionCache {
    routeMappings: Array<{
        pathPattern: string;
        layoutTemplateId: string;
        brandKitId: string;
        priority: number;
        tokenOverridesJson?: string | null;
    }>;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    brandKitsMap: Record<
        string,
        {
            brandName: string;
            tagline?: string;
            logos: Record<string, string>;
            /** Light-mode resolved theme (fully merged: preset + tenant overrides) */
            theme: ResolvedBrandTheme;
            /** Dark-mode resolved theme (returned alongside light so client picks at runtime) */
            darkTheme?: ResolvedBrandTheme;
            defaultColorScheme: string;
            allowDarkModeToggle: boolean;
            /** Custom CSS injected as-is (NOT validated for security/correctness) */
            customCss?: string;
            hideOttabaseBranding: boolean;
        }
    >;
}
