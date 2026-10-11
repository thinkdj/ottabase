// Admin data layer for the landing site (/api/landing, platform-admin only).

import { api } from '@/lib/api';
import type { LandingPageData, LeadData, LeadKind, SiteSettings } from '@ottabase/ottalanding';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

export type LandingState = { site: SiteSettings; pages: LandingPageData[] };
export type PageDraft = Omit<LandingPageData, 'id' | 'updatedAt'>;

export const LANDING_QUERY_KEY = ['landing'] as const;

export const landingApi = {
    get: () => api<LandingState>('/api/landing'),
    saveSite: (site: SiteSettings) => api<{ site: SiteSettings }>('/api/landing/site', { method: 'PUT', body: site }),
    createPage: (page: Pick<PageDraft, 'title' | 'path'>) =>
        api<{ page: LandingPageData }>('/api/landing/pages', { method: 'POST', body: page }),
    savePage: (id: string, page: PageDraft) =>
        api<{ page: LandingPageData }>(`/api/landing/pages/${encodeURIComponent(id)}`, { method: 'PUT', body: page }),
    deletePage: (id: string) => api(`/api/landing/pages/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    previewToken: (id: string, reset = false) =>
        api<{ token: string }>(`/api/landing/pages/${encodeURIComponent(id)}/preview`, {
            method: 'POST',
            body: { reset },
        }),
};

export function useLanding() {
    return useQuery({ queryKey: LANDING_QUERY_KEY, queryFn: landingApi.get, meta: { errorPresentation: 'local' } });
}

/** The public URL of a page, when the site's public URL is configured (and safe to link to). */
export function publicUrl(site: SiteSettings, path: string): string | undefined {
    if (!site.siteUrl) return undefined;
    const url = sanitizeUrl(site.siteUrl.replace(/\/+$/, '') + path);
    return url === '#' ? undefined : url;
}

/** "Pricing & plans" → "/pricing-plans" */
export function slugPath(title: string): string {
    const slug = title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `/${slug}`;
}

// ── Form entries ─────────────────────────────────────────────────────────────

export type LeadsPage = { leads: LeadData[]; total: number; unread: number };
export const LEADS_QUERY_KEY = ['landing', 'leads'] as const;

const leadsUrl = (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
    return `/api/landing/leads${query.size ? `?${query}` : ''}`;
};

export const leadsApi = {
    list: (kind: LeadKind | undefined, offset: number) => api<LeadsPage>(leadsUrl({ kind, offset: String(offset) })),
    setRead: (id: string, read: boolean) =>
        api(`/api/landing/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: { read } }),
    remove: (id: string) => api(`/api/landing/leads/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    csv: (kind?: LeadKind) => api<Blob>(leadsUrl({ kind, format: 'csv' }), { responseType: 'blob' }),
};

/** The inbox, a page at a time (newest first). */
export function useLeads(kind?: LeadKind) {
    return useInfiniteQuery({
        queryKey: [...LEADS_QUERY_KEY, kind ?? 'all'],
        queryFn: ({ pageParam }) => leadsApi.list(kind, pageParam),
        initialPageParam: 0,
        getNextPageParam: (last, pages) => {
            const loaded = pages.reduce((n, p) => n + p.leads.length, 0);
            return loaded < last.total ? loaded : undefined;
        },
        meta: { errorPresentation: 'local' },
    });
}
