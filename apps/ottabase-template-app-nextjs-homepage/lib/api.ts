/**
 * API helpers for fetching data from the Ottabase worker backend.
 *
 * Requires NEXT_PUBLIC_API_URL to be set (e.g. http://localhost:3004).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/** EditorJS block data shape */
export interface EditorJSData {
    time?: number;
    blocks: Array<{
        id?: string;
        type: string;
        data: Record<string, unknown>;
    }>;
    version?: string;
}

/** Public page data returned by /api/blog/pages/by-slug/:slug */
export interface PageData {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: EditorJSData | null;
    contentType: string;
    status: string;
    heroImage: {
        url: string;
        alt?: string;
        caption?: string;
    } | null;
    seoMeta: {
        title?: string;
        description?: string;
        keywords?: string[];
    } | null;
    authorName: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Exposed page link for homepage navbar */
export interface ExposedPage {
    slug: string;
    title: string;
}

/**
 * Fetch a published page by slug from the worker API.
 * Returns null if not found or on error.
 */
export async function fetchPageBySlug(slug: string): Promise<PageData | null> {
    if (!API_URL) return null;
    try {
        const res = await fetch(`${API_URL}/api/blog/pages/by-slug/${encodeURIComponent(slug)}`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.contentType !== 'page') return null;
        return data as PageData;
    } catch {
        return null;
    }
}

/**
 * Fetch exposed pages for the homepage navbar.
 * Returns an empty array on error so the homepage never hard-fails.
 */
export async function fetchExposedPages(): Promise<ExposedPage[]> {
    if (!API_URL) return [];
    try {
        const res = await fetch(`${API_URL}/api/blog/pages/exposed`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.exposedPages) ? data.exposedPages : [];
    } catch {
        return [];
    }
}
