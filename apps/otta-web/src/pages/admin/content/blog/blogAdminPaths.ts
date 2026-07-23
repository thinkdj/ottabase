/**
 * Blog editorial surface paths.
 *
 * The blog admin pages are mounted twice: under /admin/content/blog (the org
 * control plane) and under /studio (the writing-first editorial surface gated
 * by content permissions, not admin). This hook resolves every internal link
 * against the surface the user is actually on, so authors working in /studio
 * never get bounced into admin-gated routes.
 */
import { useLocation } from '@tanstack/react-router';

export interface BlogSurfacePaths {
    /** True when rendering under /studio. */
    inStudio: boolean;
    /** Post list (the surface root). */
    contentPath: string;
    newPath: string;
    editPath: (postId: string) => string;
    tagsPath: string;
    categoriesPath: string;
    seriesPath: string;
    /** Theme/plugin management (named 'studio' under admin, 'themes' under /studio). */
    themesPath: string;
}

export function resolveBlogSurface(pathname: string): BlogSurfacePaths {
    const inStudio = pathname === '/studio' || pathname.startsWith('/studio/');
    const base = inStudio ? '/studio' : '/admin/content/blog';
    return {
        inStudio,
        contentPath: base,
        newPath: `${base}/new`,
        editPath: (postId: string) => `${base}/${postId}/edit`,
        tagsPath: `${base}/tags`,
        categoriesPath: `${base}/categories`,
        seriesPath: `${base}/series`,
        themesPath: inStudio ? '/studio/themes' : '/admin/content/blog/studio',
    };
}

export function useBlogSurface(): BlogSurfacePaths {
    const { pathname } = useLocation();
    return resolveBlogSurface(pathname);
}
