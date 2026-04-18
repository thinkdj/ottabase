/**
 * Brand API helpers – Brand Kits, layouts, route mappings
 *
 * Uses the configured `api` client from `@/lib/api` (X-App-Id, auth, error handling).
 * brandConfigApi.get uses raw fetch (for SSR/prefetch outside api context).
 */

import { api } from '@/lib/api';

const BASE = '/api/brand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandKitItem {
    id: string;
    appId?: string | null;
    isDefault?: boolean;
    /** Parent Brand Kit ID for inheritance */
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

export interface LayoutTemplateItem {
    id: string;
    name: string;
    componentKey: string;
    config?: object;
}

export interface LayoutMappingItem {
    id?: string;
    pathPattern: string;
    layoutTemplateId: string;
    brandKitId: string;
    priority?: number;
    /** Optional per-route token overrides (partial DesignTokens JSON) */
    tokenOverridesJson?: string | null;
}

// ---------------------------------------------------------------------------
// Brand Kit API
// ---------------------------------------------------------------------------

export const brandKitApi = {
    list: () => api<BrandKitItem[]>(`${BASE}/kits`),

    get: (id: string) => api<BrandKitItem>(`${BASE}/kits/${id}`),

    create: (body: Record<string, unknown>) => api<BrandKitItem>(`${BASE}/kits`, { method: 'POST', body }),

    update: (id: string, body: Record<string, unknown>) =>
        api<BrandKitItem>(`${BASE}/kits/${id}`, { method: 'PUT', body }),

    delete: (id: string) => api<void>(`${BASE}/kits/${id}`, { method: 'DELETE' }),

    clone: (id: string, name?: string) =>
        api<BrandKitItem>(`${BASE}/kits/${id}/clone`, {
            method: 'POST',
            body: { name: name ?? undefined },
        }),

    /** Upload a logo file. FormData is handled natively by createApiClient. */
    uploadLogo: (kitId: string, logoType: 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo', file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api<{ key: string; url: string }>(`${BASE}/kits/${kitId}/logo/${logoType}`, {
            method: 'POST',
            body: formData,
        });
    },
};

// ---------------------------------------------------------------------------
// Brand Config API
// Used for fetching full brand config (e.g. SSR, prefetch). Matches BrandProvider
// fetch behavior: appId in query + X-App-Id header, cache: no-store.
// BrandProvider uses its own fetch because it runs outside api client context.
// ---------------------------------------------------------------------------

function buildBrandConfigUrl(params?: Record<string, string>): string {
    const path = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost'}${BASE}`;
    const url = new URL(path);
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v != null && v !== '') url.searchParams.set(k, v);
        });
    }
    return url.toString();
}

/** GET /api/brand – full config (route mappings, layouts, all brand kits). Client resolves path locally. */
export const brandConfigApi = {
    get: async (params?: { appId?: string | null }) => {
        const effectiveParams = params as Record<string, string> | undefined;
        const url = buildBrandConfigUrl(effectiveParams);
        const headers: Record<string, string> = {};
        if (effectiveParams?.appId) headers['X-App-Id'] = effectiveParams.appId;
        const res = await fetch(url, { cache: 'no-store', headers });
        if (!res.ok) throw new Error(`Brand config failed: ${res.status}`);
        return res.json();
    },
};

// ---------------------------------------------------------------------------
// Layout API
// ---------------------------------------------------------------------------

export const layoutApi = {
    getTemplates: () => api<LayoutTemplateItem[]>(`${BASE}/layouts`),

    putTemplate: (body: Record<string, unknown>) => api(`${BASE}/layouts`, { method: 'PUT', body }),

    getMappings: () => api<LayoutMappingItem[]>(`${BASE}/mappings`),

    putMappings: (body: {
        mappings: Array<{
            pathPattern: string;
            layoutTemplateId: string;
            brandKitId: string;
            priority?: number;
            tokenOverridesJson?: string | null;
        }>;
    }) => api(`${BASE}/mappings`, { method: 'PUT', body }),
};

// ---------------------------------------------------------------------------
// Menu Slots API – Assign menus to layout slots (sidebar-nav, header-nav, etc.)
// ---------------------------------------------------------------------------

export type MenuSlotRenderType = 'sidebar' | 'flyout' | 'mega' | 'navbar' | 'dropdown' | 'footer';

export interface MenuSlotAssignmentItem {
    id?: string;
    slotName: string;
    menuId: string;
    renderType: MenuSlotRenderType;
    sortOrder?: number;
}

export const menuSlotsApi = {
    getRaw: () => api<MenuSlotAssignmentItem[]>(`${BASE}/menu-slots/raw`),

    put: (slots: MenuSlotAssignmentItem[]) =>
        api<{ success: boolean }>(`${BASE}/menu-slots`, { method: 'PUT', body: { slots } }),
};
