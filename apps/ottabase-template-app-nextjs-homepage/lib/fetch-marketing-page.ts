import { cache } from 'react';

export type MarketingPageRecord = {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    content: unknown;
    contentType?: string;
    seoMeta?: { title?: string; description?: string; noIndex?: boolean } | null;
};

/**
 * Fetches a published Ottablog `page` post for the Next.js marketing site.
 * Uses GET /api/blog/pages/by-slug/:slug on the TanStack worker.
 */
export const fetchMarketingPageBySlug = cache(async (slug: string): Promise<MarketingPageRecord | null> => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    const safe = encodeURIComponent(slug);
    try {
        const response = await fetch(`${baseUrl}/api/blog/pages/by-slug/${safe}`, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 60 },
        });
        if (response.status === 404) return null;
        if (!response.ok) {
            console.error('Marketing page API error:', response.status, response.statusText);
            return null;
        }
        const json: unknown = await response.json();
        if (!json || typeof json !== 'object') return null;
        const o = json as Record<string, unknown>;
        if (o.contentType !== 'page') return null;
        return json as MarketingPageRecord;
    } catch (e) {
        console.error('fetchMarketingPageBySlug failed:', e);
        return null;
    }
});
