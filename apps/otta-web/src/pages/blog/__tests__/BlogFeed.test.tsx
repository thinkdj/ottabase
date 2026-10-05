import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
    search: {} as Record<string, unknown>,
    navigate: vi.fn(),
    apiClient: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
    Link: ({
        to,
        params,
        search,
        children,
        ...rest
    }: {
        to: string;
        params?: Record<string, string>;
        search?: unknown;
        children: ReactNode;
    }) => {
        const href = to.replace(/\$(\w+)/g, (_, key: string) => params?.[key] ?? '');
        const resolved = typeof search === 'function' ? search(mocks.search) : search;
        return (
            <a href={href} data-search={resolved ? JSON.stringify(resolved) : undefined} {...rest}>
                {children}
            </a>
        );
    },
}));
vi.mock('@/lib/auth', () => ({ useSession: () => ({ user: null }) }));
vi.mock('@/components/SEOHead', () => ({ SEOHead: () => null }));

import { BlogFeed } from '../BlogFeed';

const post = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: `Post ${id}`,
    slug: `post-${id}`,
    excerpt: `About ${id}`,
    contentType: 'blog',
    status: 'published',
    heroImage: null,
    author: { id: 'u1', name: 'Ada', image: null },
    readingTimeMinutes: 3,
    isFeatured: false,
    publishedAt: '2026-08-10T00:00:00Z',
    seriesId: null,
    tags: [],
    categories: [],
    ...extra,
});

const scope = { appId: 'app', organizationId: null, principalId: null };
const postCalls = () =>
    mocks.apiClient.mock.calls.map(([url]) => url as string).filter((u) => u.startsWith('/api/blog/posts?'));

function renderFeed(feedScope: Parameters<typeof BlogFeed>[0]['scope']) {
    return render(
        <OttaQueryProvider apiClient={mocks.apiClient} visibilityScope={scope}>
            <BlogFeed scope={feedScope} />
        </OttaQueryProvider>,
    );
}

describe('BlogFeed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.search = {};
        mocks.apiClient.mockImplementation(async (url: string) => {
            if (url.startsWith('/api/blog/posts?')) {
                const params = new URL(url, 'http://x').searchParams;
                const page = Number(params.get('page'));
                const data =
                    page === 1 && !params.get('search')
                        ? [post('a', { isFeatured: true }), post('b'), post('c', { seriesOrder: 3 })]
                        : [post('d')];
                return { data, pagination: { page, perPage: 12, total: 30, totalPages: 3 } };
            }
            if (url === '/api/blog/tags/by-slug/travel') return { id: 't1', name: 'Travel', slug: 'travel' };
            if (url === '/api/blog/series/by-slug/edge')
                return {
                    id: 's1',
                    title: 'Life at the edge',
                    slug: 'edge',
                    description: 'Four parts',
                    status: 'ongoing',
                };
            if (url.startsWith('/api/ottaorm/series'))
                return { data: [{ id: 's1', title: 'Life at the edge', slug: 'edge' }] };
            throw new Error('Not found');
        });
    });
    afterEach(() => vi.useRealTimers());

    it('shows the front page with a featured rail and page one of the feed', async () => {
        renderFeed({ kind: 'all' });
        expect(await screen.findByText('Post a')).toBeInTheDocument();
        expect(postCalls()).toEqual(['/api/blog/posts?page=1&perPage=12']);
        expect(screen.getByRole('heading', { name: 'Featured' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Latest' })).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
        expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('data-search', '{"page":2}');
        expect(screen.getByRole('combobox', { name: 'Browse a series' })).toHaveValue('');
    });

    it('reads the search, type and page from the URL and lists them plainly', async () => {
        mocks.search = { q: 'edge', type: 'photo', page: 2, lang: 'fr' };
        renderFeed({ kind: 'all' });
        expect(await screen.findByText('Post d')).toBeInTheDocument();
        expect(postCalls()).toEqual(['/api/blog/posts?page=2&perPage=12&contentType=photo&search=edge&lang=fr']);
        expect(screen.queryByRole('heading', { name: 'Featured' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Search posts')).toHaveValue('edge');
        expect(screen.getByLabelText('Filter by content type')).toHaveValue('photo');
        expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
            'data-search',
            '{"q":"edge","type":"photo","lang":"fr"}',
        );
        expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
            'data-search',
            '{"q":"edge","type":"photo","page":3,"lang":"fr"}',
        );
    });

    it('puts a search in the URL once typing pauses and starts again at page one', async () => {
        mocks.search = { page: 2 };
        renderFeed({ kind: 'all' });
        expect(await screen.findByText('Post d')).toBeInTheDocument();
        vi.useFakeTimers();
        fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'edge' } });
        expect(mocks.navigate).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(300));
        expect(mocks.navigate).toHaveBeenCalledTimes(1);
        const [{ search, replace }] = mocks.navigate.mock.calls[0] as [
            { search: (p: unknown) => unknown; replace: boolean },
        ];
        expect(replace).toBe(true);
        expect(search({ page: 2, lang: 'fr' })).toEqual({ q: 'edge', lang: 'fr' });
    });

    it('changes the type through the URL', async () => {
        renderFeed({ kind: 'all' });
        expect(await screen.findByText('Post a')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Filter by content type'), { target: { value: 'blurb' } });
        const [{ search }] = mocks.navigate.mock.calls[0] as [{ search: (p: unknown) => unknown }];
        expect(search({ q: 'x', page: 3 })).toEqual({ q: 'x', type: 'blurb' });
    });

    it('opens a series from the series menu', async () => {
        renderFeed({ kind: 'all' });
        expect(await screen.findByText('Post a')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', { name: 'Browse a series' }), { target: { value: 'edge' } });
        expect(mocks.navigate).toHaveBeenCalledWith({ to: '/blog/series/$slug', params: { slug: 'edge' }, search: {} });
    });

    it('scopes to a tag once it is resolved by slug', async () => {
        renderFeed({ kind: 'tag', slug: 'travel' });
        expect(await screen.findByRole('heading', { level: 1, name: 'Travel' })).toBeInTheDocument();
        expect(await screen.findByText('Post a')).toBeInTheDocument();
        expect(postCalls()).toEqual(['/api/blog/posts?page=1&perPage=12&tagId=t1']);
        expect(screen.getByText('Tag')).toBeInTheDocument();
        expect(screen.getByText('30 posts')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to Blog' })).toHaveAttribute('href', '/blog');
        expect(screen.queryByRole('heading', { name: 'Featured' })).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Browse a series' })).not.toBeInTheDocument();
    });

    it('says when the tag does not exist', async () => {
        renderFeed({ kind: 'tag', slug: 'nope' });
        expect(await screen.findByText('Tag not found')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to Blog' })).toHaveAttribute('href', '/blog');
        expect(postCalls()).toEqual([]);
    });

    it('lists a series in order with its parts numbered', async () => {
        renderFeed({ kind: 'series', slug: 'edge' });
        expect(await screen.findByRole('heading', { level: 1, name: 'Life at the edge' })).toBeInTheDocument();
        await waitFor(() =>
            expect(postCalls()).toEqual([
                '/api/blog/posts?page=1&perPage=50&seriesId=s1&orderBy=seriesOrder&orderDirection=asc',
            ]),
        );
        expect(await screen.findByText('Part 3')).toBeInTheDocument();
        expect(screen.getByText('Part 1')).toBeInTheDocument();
        expect(screen.getByText('Four parts')).toBeInTheDocument();
        expect(screen.getByText('ongoing')).toBeInTheDocument();
        expect(screen.getByText('30 parts')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Browse a series' })).toHaveValue('edge');
    });

    it('walks a month archive by the months either side', async () => {
        vi.setSystemTime(new Date(Date.UTC(2026, 9, 5)));
        renderFeed({ kind: 'date', year: 2026, month: 8 });
        expect(await screen.findByRole('heading', { level: 1, name: 'August 2026' })).toBeInTheDocument();
        await waitFor(() => expect(postCalls()).toEqual(['/api/blog/posts?page=1&perPage=12&year=2026&month=8']));
        expect(screen.getByRole('link', { name: 'Previous month' })).toHaveAttribute('href', '/blog/archive/2026/7');
        expect(screen.getByRole('link', { name: 'All of 2026' })).toHaveAttribute('href', '/blog/archive/2026');
        expect(screen.getByRole('link', { name: 'Next month' })).toHaveAttribute('href', '/blog/archive/2026/9');
    });

    it('turns a bad date into a not-found panel', () => {
        renderFeed(null);
        expect(screen.getByText('No such date')).toBeInTheDocument();
        expect(mocks.apiClient).not.toHaveBeenCalled();
    });
});
