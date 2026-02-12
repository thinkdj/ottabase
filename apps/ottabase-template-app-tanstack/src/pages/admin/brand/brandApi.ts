/**
 * Brand API helpers – Brand Kits, layouts, route mappings
 */

const BASE = '/api/brand';

function brandUrl(path: string, params?: Record<string, string>) {
    const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v != null && v !== '') url.searchParams.set(k, v);
        });
    }
    return url.pathname + url.search;
}

/** Default fetch options for brand API – ensures auth cookies are sent (needed for mutating routes) */
const fetchOpts = { credentials: 'include' as RequestCredentials };

export interface BrandKitItem {
    id: string;
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

export const brandKitApi = {
    list: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/kits`, params as Record<string, string>), fetchOpts).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ) as Promise<BrandKitItem[]>,

    get: (id: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/kits/${id}`, params as Record<string, string>), fetchOpts).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ) as Promise<BrandKitItem>,

    create: (body: Record<string, unknown>, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/kits`, params as Record<string, string>), {
            ...fetchOpts,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))) as Promise<BrandKitItem>,

    update: (
        id: string,
        body: Record<string, unknown>,
        params?: { organizationId?: string | null; appId?: string | null },
    ) =>
        fetch(brandUrl(`${BASE}/kits/${id}`, params as Record<string, string>), {
            ...fetchOpts,
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))) as Promise<BrandKitItem>,

    delete: (id: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/kits/${id}`, params as Record<string, string>), {
            ...fetchOpts,
            method: 'DELETE',
        }).then((r) => (r.ok ? Promise.resolve() : Promise.reject(r))),

    clone: (id: string, name?: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/kits/${id}/clone`, params as Record<string, string>), {
            ...fetchOpts,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name ?? undefined }),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))) as Promise<BrandKitItem>,

    uploadLogo: (
        kitId: string,
        logoType: 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo',
        file: File,
        params?: { organizationId?: string | null; appId?: string | null },
    ) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(brandUrl(`${BASE}/kits/${kitId}/logo/${logoType}`, params as Record<string, string>), {
            ...fetchOpts,
            method: 'POST',
            body: formData,
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))) as Promise<{ key: string; url: string }>;
    },
};

/** GET /api/brand – full config (route mappings, layouts, all brand kits). Client resolves path locally. */
export const brandConfigApi = {
    get: (params?: { organizationId?: string | null; appId?: string | null; mode?: 'light' | 'dark' }) =>
        fetch(brandUrl(BASE, params as Record<string, string>)).then((r) => (r.ok ? r.json() : Promise.reject(r))),
};

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
}

export const layoutApi = {
    getTemplates: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/layouts`, params as Record<string, string>)).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ) as Promise<LayoutTemplateItem[]>,

    putTemplate: (body: Record<string, unknown>, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/layouts`, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    getMappings: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/mappings`, params as Record<string, string>)).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ) as Promise<LayoutMappingItem[]>,

    putMappings: (
        body: {
            mappings: Array<{
                pathPattern: string;
                layoutTemplateId: string;
                brandKitId: string;
                priority?: number;
            }>;
        },
        params?: { organizationId?: string | null; appId?: string | null },
    ) =>
        fetch(brandUrl(`${BASE}/mappings`, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
};
