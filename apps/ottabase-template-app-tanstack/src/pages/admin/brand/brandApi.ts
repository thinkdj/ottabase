/**
 * Brand API helpers – endpoints for Brand Admin UI
 */

const BASE = '/api/brand';
const BOX_BASE = '/api/brandbox';

function brandUrl(path: string, params?: Record<string, string>) {
    const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v != null && v !== '') url.searchParams.set(k, v);
        });
    }
    return url.pathname + url.search;
}

export const brandApi = {
    getConfig: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(BASE, params as Record<string, string>)).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    updateSettings: (
        body: Record<string, unknown>,
        params?: { organizationId?: string | null; appId?: string | null },
    ) =>
        fetch(brandUrl(BASE, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    uploadLogo: (logoType: string, file: File, params?: { organizationId?: string | null; appId?: string | null }) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(brandUrl(`${BASE}/logo/${logoType}`, params as Record<string, string>), {
            method: 'POST',
            body: formData,
        }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
    },
};

export const brandboxApi = {
    list: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(BOX_BASE, params as Record<string, string>)).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    create: (body: Record<string, unknown>, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(BOX_BASE, params as Record<string, string>), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    update: (
        id: string,
        body: Record<string, unknown>,
        params?: { organizationId?: string | null; appId?: string | null },
    ) =>
        fetch(brandUrl(`${BOX_BASE}/${id}`, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    delete: (id: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BOX_BASE}/${id}`, params as Record<string, string>), { method: 'DELETE' }).then((r) =>
            r.ok ? Promise.resolve() : Promise.reject(r),
        ),

    apply: (brandBoxId: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/apply`, params as Record<string, string>), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandBoxId }),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    duplicate: (id: string, name?: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BOX_BASE}/${id}/duplicate`, params as Record<string, string>), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name ?? undefined }),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
};

export const themeVariantApi = {
    list: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/themes`, params as Record<string, string>)).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ),

    create: (body: Record<string, unknown>, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/themes`, params as Record<string, string>), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    update: (
        id: string,
        body: Record<string, unknown>,
        params?: { organizationId?: string | null; appId?: string | null },
    ) =>
        fetch(brandUrl(`${BASE}/themes/${id}`, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    delete: (id: string, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/themes/${id}`, params as Record<string, string>), { method: 'DELETE' }).then((r) =>
            r.ok ? Promise.resolve() : Promise.reject(r),
        ),
};

export const layoutApi = {
    getTemplates: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/layouts`, params as Record<string, string>)).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ),

    putTemplate: (body: Record<string, unknown>, params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/layouts`, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),

    getMappings: (params?: { organizationId?: string | null; appId?: string | null }) =>
        fetch(brandUrl(`${BASE}/mappings`, params as Record<string, string>)).then((r) =>
            r.ok ? r.json() : Promise.reject(r),
        ),

    putMappings: (
        body: { mappings: Array<{ pathPattern: string; layoutTemplateId: string; priority?: number }> },
        params?: { organizationId?: string | null; appId?: string | null },
    ) =>
        fetch(brandUrl(`${BASE}/mappings`, params as Record<string, string>), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
};
