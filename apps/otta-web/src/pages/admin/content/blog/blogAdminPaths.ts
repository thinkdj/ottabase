/**
 * Blog editorial surface paths.
 *
 * The blog admin pages are mounted twice: under /admin/content/blog (the org
 * control plane) and under /studio (the writing-first editorial surface gated
 * by content permissions, not admin). This hook resolves every internal link
 * against the surface the user is actually on, so authors working in /studio
 * never get bounced into admin-gated routes.
 */
import { ORG_BLOGS_ENABLED } from '@/ottabase/config';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { BlogInfo, BlogLanguageConfig, ContentType } from '@ottabase/ottablog';
import { blogPostPath } from '@ottabase/ottablog/paths';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { useLocation } from '@tanstack/react-router';
import { useAtomValue } from 'jotai';

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
    /** Content settings: theme, plugins, languages, demo content. */
    settingsPath: string;
}

/** Build a safe public URL for saved content of a blog (`blogSlug` null: the site blog). */
export function getPublicContentPath(slug: string, contentType: ContentType, blogSlug: string | null = null): string {
    const encodedSlug = encodeURIComponent(slug);
    const path =
        contentType === 'changelog'
            ? `/changelog/${encodedSlug}`
            : contentType === 'docs'
              ? `/docs/${encodedSlug}`
              : blogPostPath(blogSlug, slug);
    return sanitizeUrl(path);
}

/** GET /api/blog/studio/blog: the blog an editor writes to. */
export interface EditorialBlog {
    /** The active organization's blog, or null for the site blog (Platform scope). */
    blog: BlogInfo | null;
    languageConfig: BlogLanguageConfig;
}

/**
 * The blog the editorial surface works on: the active organization's, or the site blog in Platform
 * scope. Keyed by the active organization, so switching it reloads; a language save refreshes it
 * through the shared `blog_settings` entity.
 */
export function useEditorialBlog() {
    const organizationId = useAtomValue(organizationIdAtom);
    const { data, isLoading } = useApiQuery<EditorialBlog>({
        entity: 'blog_settings',
        queryKey: ['editorial-blog', organizationId],
        endpoint: '/api/blog/studio/blog',
        queryOptions: { staleTime: 60_000 },
    });
    const blog = data?.blog ?? null;
    return {
        data,
        isLoading,
        blog,
        /** Readers can open it: the site blog, or an organization's while organization blogs are on. */
        isPublic: !blog || ORG_BLOGS_ENABLED,
    };
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
        settingsPath: inStudio ? '/studio/settings' : '/admin/content/blog/settings',
    };
}

export function useBlogSurface(): BlogSurfacePaths {
    const { pathname } = useLocation();
    return resolveBlogSurface(pathname);
}
