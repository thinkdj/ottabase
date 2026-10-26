/**
 * Public blog URLs: the site blog lives at /blog, an organization's blog at /blogs/{orgSlug}.
 *
 * One contract for every place that builds or reads a blog URL: SPA routes and links, RSS,
 * sitemap, preview links, and the edge SEO/theme injectors. Pure and React-free.
 */

export const SITE_BLOG_PATH = '/blog';
export const ORG_BLOGS_PATH = '/blogs';

/** Base path of a blog: `/blog`, or `/blogs/{orgSlug}` for an organization's blog. */
export function blogBasePath(blogSlug?: string | null): string {
    return blogSlug ? `${ORG_BLOGS_PATH}/${encodeURIComponent(blogSlug)}` : SITE_BLOG_PATH;
}

/** A post's public path, with `?lang=` when it is a translation. */
export function blogPostPath(blogSlug: string | null | undefined, postSlug: string, language?: string | null): string {
    const path = `${blogBasePath(blogSlug)}/${encodeURIComponent(postSlug)}`;
    return language ? `${path}?lang=${encodeURIComponent(language)}` : path;
}

/** Archive pages under a blog: tag, category, series and author. */
export function blogArchivePath(
    blogSlug: string | null | undefined,
    kind: 'tag' | 'category' | 'series' | 'author',
    value: string,
): string {
    return `${blogBasePath(blogSlug)}/${kind}/${encodeURIComponent(value)}`;
}

/** Date archive: a year, or a month of it. */
export function blogDateArchivePath(blogSlug: string | null | undefined, year: number, month?: number): string {
    return `${blogBasePath(blogSlug)}/archive/${year}${month ? `/${month}` : ''}`;
}

/**
 * Split a document path into its blog and the rest: `/blogs/acme/my-post` gives
 * `{ blogSlug: 'acme', rest: 'my-post' }`, `/blog` gives `{ blogSlug: null, rest: '' }`.
 * Null for a path outside every blog, or one that does not decode.
 */
export function parseBlogPath(pathname: string): { blogSlug: string | null; rest: string } | null {
    try {
        if (pathname === SITE_BLOG_PATH || pathname.startsWith(`${SITE_BLOG_PATH}/`)) {
            return { blogSlug: null, rest: decodeURIComponent(pathname.slice(SITE_BLOG_PATH.length + 1)) };
        }
        if (pathname.startsWith(`${ORG_BLOGS_PATH}/`)) {
            const [slug, ...rest] = pathname.slice(ORG_BLOGS_PATH.length + 1).split('/');
            if (!slug) return null;
            return { blogSlug: decodeURIComponent(slug), rest: decodeURIComponent(rest.join('/')) };
        }
    } catch {
        // A malformed escape is not a blog page.
    }
    return null;
}

/**
 * The post a detail document path points at: exactly one segment under a blog base. The base
 * itself and deeper archive paths (`/blog/tag/x`) are not post pages.
 */
export function parseBlogPostPath(pathname: string): { blogSlug: string | null; postSlug: string } | null {
    const parsed = parseBlogPath(pathname);
    if (!parsed || !parsed.rest || parsed.rest.includes('/')) return null;
    return { blogSlug: parsed.blogSlug, postSlug: parsed.rest };
}
