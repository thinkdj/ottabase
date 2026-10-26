/**
 * The blog a public page belongs to.
 *
 * Every public blog route renders inside a BlogScope. It reads the blog from the URL (/blog is the
 * site blog, /blogs/{org} an organization's), loads that blog's public state (identity, theme,
 * plugins, languages) and applies it before themed content renders. Pages build every link and
 * API call through it, so one set of pages serves every blog.
 */

import { NotFoundPage } from '@/components/NotFoundPage';
import type { BlogInfo, StudioState } from '@ottabase/ottablog';
import { blogArchivePath, blogBasePath, blogDateArchivePath, blogPostPath } from '@ottabase/ottablog/paths';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { useParams } from '@tanstack/react-router';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyBlogState } from './init';

/** GET /api/blog/studio/state: what a reader's browser needs to render one blog. */
export type PublicBlogState = StudioState & { blog: BlogInfo | null };

type QueryValue = string | number | boolean | null | undefined;

export interface BlogLinks {
    /** The organization's slug, or null for the site blog. */
    slug: string | null;
    /** The blog's home: /blog or /blogs/{slug}. */
    base: string;
    post: (postSlug: string, language?: string | null) => string;
    archive: (kind: 'tag' | 'category' | 'series' | 'author', value: string) => string;
    date: (year: number, month?: number) => string;
    /** A public blog API URL for this blog: /api/blog{path}, with `blog=` for an organization's. */
    api: (path: string, params?: Record<string, QueryValue>) => string;
}

export interface BlogScopeValue extends BlogLinks {
    /** The organization blog's identity once loaded; null for the site blog. */
    info: BlogInfo | null;
    /** The blog's theme and plugins are applied, so themed content may render. */
    isReady: boolean;
}

export function blogLinks(slug: string | null): BlogLinks {
    return {
        slug,
        base: blogBasePath(slug),
        post: (postSlug, language) => blogPostPath(slug, postSlug, language),
        archive: (kind, value) => blogArchivePath(slug, kind, value),
        date: (year, month) => blogDateArchivePath(slug, year, month),
        api: (path, params) => {
            const [pathname, search] = path.split('?');
            const query = new URLSearchParams(search);
            for (const [key, value] of Object.entries(params ?? {})) {
                if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
            }
            if (slug) query.set('blog', slug);
            const queryString = query.toString();
            return `/api/blog${pathname}${queryString ? `?${queryString}` : ''}`;
        },
    };
}

const BlogScopeContext = createContext<BlogScopeValue>({ ...blogLinks(null), info: null, isReady: false });

/** The blog of the page being rendered. Outside a BlogScope: the site blog, not yet themed. */
export function useBlogScope(): BlogScopeValue {
    return useContext(BlogScopeContext);
}

/** A failed (non-404) state load still renders the blog, on the built-in defaults. */
const DEFAULTS_ONLY = null;

export function BlogScope({ children }: { children: ReactNode }) {
    const { org } = useParams({ strict: false }) as { org?: string };
    const links = useMemo(() => blogLinks(org ?? null), [org]);
    const { data, error } = useApiQuery<PublicBlogState>({
        queryKey: ['blog-state', links.slug],
        endpoint: links.api('/studio/state'),
        queryOptions: { staleTime: 5 * 60 * 1000 },
    });
    const notFound = error?.status === 404;
    const state = data ?? (error && !notFound ? DEFAULTS_ONLY : undefined);

    // The state object applied last: content is themed once it is the current one.
    const [applied, setApplied] = useState<PublicBlogState | null | undefined>(undefined);
    useEffect(() => {
        if (state === undefined) return;
        let cancelled = false;
        void applyBlogState(state).then(() => {
            if (!cancelled) setApplied(state);
        });
        return () => {
            cancelled = true;
        };
    }, [state]);

    const value = useMemo<BlogScopeValue>(
        () => ({ ...links, info: data?.blog ?? null, isReady: state !== undefined && applied === state }),
        [links, data, state, applied],
    );
    if (notFound) return <NotFoundPage />;
    return <BlogScopeContext.Provider value={value}>{children}</BlogScopeContext.Provider>;
}
