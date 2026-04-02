/**
 * API helpers for fetching data from the Ottabase worker backend.
 *
 * Requires NEXT_PUBLIC_API_URL to be set (e.g. http://localhost:3004).
 *
 * Types are re-exported from `@ottabase/homepage-contract` — the shared
 * Zod-inferred contract package — so Next.js and the TanStack worker
 * always agree on the payload shape.
 */

import type { ExposedPage, HomepageDataPayload, NavPagesPayload, PageDataPayload } from '@ottabase/homepage-contract';

// Re-export shared contract types so existing imports continue to work
export type {
    ExposedPage,
    HomepageActionPayload,
    HomepageDataPayload,
    HomepageDisplayPayload,
    HomepageFeaturePayload,
    HomepageSectionPayload,
    NavPagePayload,
    NavPagesPayload,
    // New flexible page system types
    PageDataPayload,
    PageDisplayPayload,
    PageMetaPayload,
    PageSectionPayload,
} from '@ottabase/homepage-contract';

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
 * Fetch the full homepage data payload from the worker API.
 * Includes sections (with features + actions), display settings, and exposed pages.
 * Returns safe defaults on error so the homepage never hard-fails.
 */
export async function fetchHomepageData(): Promise<HomepageDataPayload> {
    const fallback: HomepageDataPayload = {
        sections: [],
        display: {
            variantBySlot: null,
            themePreset: null,
            fallbackThemePresetId: null,
            customCss: null,
            seoTitle: null,
            seoDescription: null,
        },
        exposedPages: [],
    };
    if (!API_URL) return fallback;
    try {
        const res = await fetch(`${API_URL}/api/homepage/data`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return fallback;
        const data = await res.json();
        return {
            sections: Array.isArray(data.sections) ? data.sections : [],
            display: data.display ?? fallback.display,
            exposedPages: Array.isArray(data.exposedPages) ? data.exposedPages : [],
        };
    } catch {
        return fallback;
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

// ============================================================================
// NEW FLEXIBLE PAGE SYSTEM API
// ============================================================================

/**
 * Fetch page data by slug from the new flexible page system.
 * Use this for pages created via /admin/pages.
 * Returns null on error.
 */
export async function fetchPageByPageSlug(slug: string, preview = false): Promise<PageDataPayload | null> {
    if (!API_URL) return null;
    try {
        const url = new URL(`${API_URL}/api/pages/${encodeURIComponent(slug)}`);
        if (preview) url.searchParams.set('preview', 'true');
        const res = await fetch(url.toString(), {
            next: { revalidate: preview ? 0 : 60 }, // No cache in preview mode
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Fetch nav-enabled pages from the new flexible page system.
 * Returns pages marked with showInNav=true, sorted by navOrder.
 */
export async function fetchNavPages(): Promise<NavPagesPayload['pages']> {
    if (!API_URL) return [];
    try {
        const res = await fetch(`${API_URL}/api/pages/nav`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return [];
        const data: NavPagesPayload = await res.json();
        return Array.isArray(data.pages) ? data.pages : [];
    } catch {
        return [];
    }
}
