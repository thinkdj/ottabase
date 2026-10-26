/**
 * BlogScope: the blog a public page shows comes from the URL, and every link and API call is built
 * for that blog. An organization blog the server does not serve is a not-found page.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, params, applyBlogState } = vi.hoisted(() => ({
    query: { current: {} as { data?: unknown; error?: { status: number } | null } },
    params: { current: {} as { org?: string } },
    applyBlogState: vi.fn(async () => undefined),
}));

vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: vi.fn(() => query.current),
}));
vi.mock('@tanstack/react-router', () => ({ useParams: () => params.current }));
vi.mock('@/components/NotFoundPage', () => ({ NotFoundPage: () => <p>Not found</p> }));
vi.mock('../init', () => ({ applyBlogState }));

import { useApiQuery } from '@ottabase/ottaorm/client';
import { BlogScope, blogLinks, useBlogScope } from '../BlogScope';

function Probe() {
    const blog = useBlogScope();
    return (
        <p>
            {blog.info?.name ?? 'site'}|{blog.base}|{String(blog.isReady)}
        </p>
    );
}

describe('blogLinks', () => {
    it('builds the site blog at /blog with plain API calls', () => {
        const site = blogLinks(null);
        expect(site.base).toBe('/blog');
        expect(site.post('hello', 'ml')).toBe('/blog/hello?lang=ml');
        expect(site.archive('tag', 'a b')).toBe('/blog/tag/a%20b');
        expect(site.date(2026, 9)).toBe('/blog/archive/2026/9');
        expect(site.api('/posts', { page: 2, lang: '', seriesId: undefined })).toBe('/api/blog/posts?page=2');
    });

    it("builds an organization's blog at /blogs/{slug} and names it on every API call", () => {
        const acme = blogLinks('acme');
        expect(acme.base).toBe('/blogs/acme');
        expect(acme.post('hello')).toBe('/blogs/acme/hello');
        expect(acme.api('/posts?page=1', { lang: 'en' })).toBe('/api/blog/posts?page=1&lang=en&blog=acme');
        expect(acme.api('/studio/state')).toBe('/api/blog/studio/state?blog=acme');
    });
});

describe('BlogScope', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        params.current = {};
        query.current = {};
    });

    it("loads the URL's blog, applies its state, then reports it ready", async () => {
        params.current = { org: 'acme' };
        const state = { activeThemeId: null, themes: [], plugins: [], blog: { slug: 'acme', name: 'Acme' } };
        query.current = { data: state, error: null };

        render(
            <BlogScope>
                <Probe />
            </BlogScope>,
        );

        expect(vi.mocked(useApiQuery).mock.calls[0][0]).toMatchObject({
            queryKey: ['blog-state', 'acme'],
            endpoint: '/api/blog/studio/state?blog=acme',
        });
        await waitFor(() => expect(screen.getByText('Acme|/blogs/acme|true')).toBeTruthy());
        expect(applyBlogState).toHaveBeenCalledWith(state);
    });

    it('renders the site blog on the defaults when its state cannot load', async () => {
        query.current = { data: undefined, error: { status: 500 } };

        render(
            <BlogScope>
                <Probe />
            </BlogScope>,
        );

        await waitFor(() => expect(screen.getByText('site|/blog|true')).toBeTruthy());
        expect(applyBlogState).toHaveBeenCalledWith(null);
    });

    it('is a not-found page for a blog the server does not serve', () => {
        params.current = { org: 'nope' };
        query.current = { data: undefined, error: { status: 404 } };

        render(
            <BlogScope>
                <Probe />
            </BlogScope>,
        );

        expect(screen.getByText('Not found')).toBeTruthy();
        expect(applyBlogState).not.toHaveBeenCalled();
    });
});
