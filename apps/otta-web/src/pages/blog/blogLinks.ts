/** Build a self-contained URL query for a localized public post link. */
export function localizedPostSearch(
    post: { language?: string | null; translationId?: string | null },
    requestedLanguage?: string,
): { lang: string } | undefined {
    const language = post.translationId ? post.language : requestedLanguage;
    return language ? { lang: language } : undefined;
}
