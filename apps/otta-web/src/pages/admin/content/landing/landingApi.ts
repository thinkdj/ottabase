// Admin data layer for the landing site (/api/landing, platform-admin only).

import { api } from '@/lib/api';
import type { LandingPageData, SiteSettings } from '@ottabase/ottalanding';
import { useQuery } from '@tanstack/react-query';

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
};

export function useLanding() {
    return useQuery({ queryKey: LANDING_QUERY_KEY, queryFn: landingApi.get, meta: { errorPresentation: 'local' } });
}

/** The public URL of a page, when the site's public URL is configured. */
export function publicUrl(site: SiteSettings, path: string): string | undefined {
    return site.siteUrl ? site.siteUrl.replace(/\/+$/, '') + path : undefined;
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
