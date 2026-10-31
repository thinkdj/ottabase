/**
 * The comments moderation queue: pending comments listed with their author and post (titles in one
 * batched request), each approved, hidden or deleted through PATCH on the OttaORM comments route.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, toast } = vi.hoisted(() => ({ api: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', async () => {
    const real = await import('@ottabase/api');
    return { api, getErrorMessage: real.getErrorMessage };
});
vi.mock('@ottabase/ui', async (importOriginal) => ({ ...(await importOriginal<object>()), toast }));

import { AdminCommentsPage } from '../AdminCommentsPage';

const page = <T,>(data: T[]) => ({ data, pagination: { page: 1, perPage: 25, total: data.length, totalPages: 1 } });
const COMMENTS = [
    { id: 'c1', body: '<b>Lovely</b>\nwrite-up', targetType: 'post', targetId: 'p1', userId: null, authorName: 'Ada' },
    {
        id: 'c2',
        body: 'Second',
        targetType: 'post',
        targetId: 'p2',
        userId: 'u1',
        authorName: null,
        _user: { id: 'u1', name: 'Grace Hopper', image: null, createdAt: 0 },
    },
    { id: 'c3', body: 'Third', targetType: 'post', targetId: 'p1', userId: null, authorName: 'Linus' },
].map((c) => ({ status: 'pending', createdAt: Date.UTC(2026, 9, 31), ...c }));
const POSTS = [
    { id: 'p1', title: 'Hello world', slug: 'hello-world', contentType: 'blog' },
    { id: 'p2', title: 'Release notes', slug: 'v2', contentType: 'changelog' },
];

const calls = (prefix: string) => api.mock.calls.filter(([url]) => String(url).startsWith(prefix));
const whereOf = (url: string) => JSON.parse(new URL(url, 'https://x.test').searchParams.get('where')!);

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AdminCommentsPage />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (init?.method === 'PATCH') return {};
        if (url.startsWith('/api/ottaorm/posts')) return page(POSTS);
        return page(whereOf(url).status === 'pending' ? COMMENTS : []);
    });
});

describe('AdminCommentsPage', () => {
    it('lists pending comments without a target, as plain text, with post titles from one request', async () => {
        renderPage();

        const link = await screen.findAllByRole('link', { name: 'Hello world' });
        expect(link[0]).toHaveAttribute('href', '/blog/hello-world');
        expect(screen.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', '/changelog/v2');
        // Markup in a comment is text, never HTML.
        expect(screen.getByText(/<b>Lovely<\/b>/)).toBeInTheDocument();
        expect(screen.getByText('Ada')).toBeInTheDocument();
        expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
        expect(screen.getAllByText('Guest')).toHaveLength(2);

        const [listUrl] = calls('/api/ottaorm/comments')[0];
        expect(whereOf(listUrl)).toEqual({ status: 'pending' });
        const postCalls = calls('/api/ottaorm/posts');
        expect(postCalls).toHaveLength(1);
        expect(whereOf(postCalls[0][0])).toEqual({ id: { $in: ['p1', 'p2'] } });
    });

    it('approves, hides and (after confirming) deletes through PATCH status', async () => {
        renderPage();
        await screen.findByText('Ada');

        fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/ottaorm/comments/c1', {
                method: 'PATCH',
                body: { status: 'active' },
            }),
        );
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Comment published'));

        fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[1]);
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/ottaorm/comments/c2', {
                method: 'PATCH',
                body: { status: 'hidden' },
            }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete comment from Linus' }));
        expect(api).not.toHaveBeenCalledWith('/api/ottaorm/comments/c3', expect.anything());
        fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/ottaorm/comments/c3', {
                method: 'PATCH',
                body: { status: 'deleted' },
            }),
        );
    });

    it('shows hidden comments under the Hidden filter', async () => {
        renderPage();
        await screen.findByText('Ada');

        fireEvent.click(screen.getByRole('radio', { name: 'Hidden' }));

        expect(await screen.findByText('No hidden comments')).toBeInTheDocument();
        expect(whereOf(calls('/api/ottaorm/comments').at(-1)![0])).toEqual({ status: 'hidden' });
    });
});
