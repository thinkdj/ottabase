// ---------------------------------------------------------------------------
// Brand Engine – Resolved config types (API response shape, KV cache)
// v2: Per-app scoping – no organizationId references
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import type { MenuItemDto, MenuRenderType } from '@ottabase/ottamenu';
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
    /** Menu slot assignments with resolved menu data (slot name → menus) */
    menuSlots?: Record<string, ResolvedMenuSlot[]>;
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

// ── Menu Slot types ────────────────────────────────────────────────────────

/** Valid render types for menus in slots */
export type MenuSlotRenderType = 'sidebar' | 'flyout' | 'mega' | 'navbar' | 'dropdown' | 'footer';

/** Menu slot assignment item (API shape) */
export interface MenuSlotAssignmentItem {
    id?: string;
    slotName: string;
    menuId: string;
    renderType: MenuSlotRenderType;
    sortOrder?: number;
}

/** Resolved menu slot with full menu data (included in GET /api/brand response) */
export interface ResolvedMenuSlot {
    slotName: string;
    menuId: string;
    renderType: MenuSlotRenderType;
    sortOrder: number;
    menu: {
        id: string;
        appId: string | null;
        name: string;
        slug: string;
        type: string;
        items: MenuItemDto[];
    };
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
    /** Menu slot assignments with resolved menu data */
    menuSlots?: Record<string, ResolvedMenuSlot[]>;
    brandKitsMap: Record<
        string,
        {
            brandName: string;
            tagline?: string;
            logos: Record<string, string>;
            /** Light-mode resolved theme (fully merged: preset + tenant overrides) */
            theme: ResolvedBrandTheme;
            /** Dark-mode resolved theme (returned alongside light so client picks at runtime) */
            darkTheme?: Partial<ResolvedBrandTheme>;
            defaultColorScheme: string;
            allowDarkModeToggle: boolean;
            /** Custom CSS injected as-is (NOT validated for security/correctness) */
            customCss?: string;
            hideOttabaseBranding: boolean;
        }
    >;
}

// ── Menu CRUD payload types ────────────────────────────────────────────────

/** Menu with items (API list/detail response) */
export interface MenuWithItemsDto {
    id: string;
    appId: string | null;
    name: string;
    slug: string;
    type: MenuRenderType;
    isDefault?: boolean;
    items: MenuItemDto[];
    createdAt?: number;
    updatedAt?: number;
}

/** Create menu payload */
export interface CreateMenuPayload {
    name: string;
    slug: string;
    type?: MenuRenderType;
    isDefault?: boolean;
}

/** Update menu payload */
export interface UpdateMenuPayload {
    name?: string;
    slug?: string;
    type?: MenuRenderType;
    isDefault?: boolean;
}

/** Create menu item payload */
export interface CreateMenuItemPayload {
    menuId: string;
    parentId?: string | null;
    name: string;
    link: string;
    newTab?: boolean;
    authRequired?: boolean;
    description?: string | null;
    image?: string | null;
    tooltip?: string | null;
    sortOrder?: number;
}

/** Update menu item payload */
export interface UpdateMenuItemPayload {
    parentId?: string | null;
    name?: string;
    link?: string;
    newTab?: boolean;
    authRequired?: boolean;
    description?: string | null;
    image?: string | null;
    tooltip?: string | null;
    sortOrder?: number;
}
