/** Build a self-contained URL query for a localized public post link. */
export function localizedPostSearch(
    post: { language?: string | null; translationId?: string | null },
    requestedLanguage?: string,
): { lang: string } | undefined {
    const language = post.translationId ? post.language : requestedLanguage;
    return language ? { lang: language } : undefined;
}

/** Build the canonical-slug URL used when switching a public post language. */
export function localizedPostPath(slug: string, language: string): string {
    return `/blog/${encodeURIComponent(slug)}?lang=${encodeURIComponent(language)}`;
}

/** URL state shared by the public feed and every archive: `/blog?q=edge&type=photo&page=2&lang=fr`. */
export interface BlogFeedSearch {
    q?: string;
    type?: string;
    page?: number;
    lang?: string;
}

/** Keeps only what the feed understands. Page 1 and an empty search are the defaults, so they leave the URL. */
export function blogFeedSearch(s: Record<string, unknown>): BlogFeedSearch {
    const out: BlogFeedSearch = {};
    if (typeof s.q === 'string' && s.q.trim()) out.q = s.q;
    if (typeof s.type === 'string' && s.type) out.type = s.type;
    const page = Number(s.page);
    if (Number.isInteger(page) && page > 1) out.page = page;
    if (typeof s.lang === 'string' && s.lang) out.lang = s.lang;
    return out;
}
