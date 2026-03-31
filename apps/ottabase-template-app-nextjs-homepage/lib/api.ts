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

/** Homepage section from the public API */
export interface HomepageSectionPayload {
    id: string;
    slot: string;
    title: string | null;
    subtitle: string | null;
    body: string | null;
    githubUrl: string | null;
    icon: string | null;
    enabled: boolean;
    cssClasses: string | null;
    metadata: Record<string, unknown> | null;
    sortOrder: number;
    features: Array<{
        title: string;
        description: string;
        icon: string | null;
        imageUrl: string | null;
        href: string | null;
    }>;
    actions: Array<{
        label: string;
        href: string;
        variant: string | null;
        icon: string | null;
        external: boolean;
    }>;
}

/** Homepage display settings from the public API */
export interface HomepageDisplayPayload {
    variantBySlot: Record<string, string> | null;
    themePreset: string | null;
    fallbackThemePresetId: string | null;
    customCss: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
}

/** Full homepage data payload from GET /api/homepage/data */
export interface HomepageDataPayload {
    sections: HomepageSectionPayload[];
    display: HomepageDisplayPayload;
    exposedPages: ExposedPage[];
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
