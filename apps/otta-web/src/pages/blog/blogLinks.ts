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
