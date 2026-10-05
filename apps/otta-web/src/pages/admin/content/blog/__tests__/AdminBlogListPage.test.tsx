import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, apiClient } = vi.hoisted(() => ({ navigate: vi.fn(), apiClient: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigate,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));
vi.mock('../BlogAdminNav', () => ({ BlogAdminNav: () => null }));
vi.mock('../BlogImportExport', () => ({ BlogImportExport: () => null }));
vi.mock('../blogAdminPaths', () => ({
    useBlogSurface: () => ({
        newPath: '/admin/content/blog/new',
        editPath: (id: string) => `/admin/content/blog/${id}/edit`,
    }),
    getPublicContentPath: (slug: string) => `/blog/${slug}`,
}));

import { AdminBlogListPage } from '../AdminBlogListPage';

const posts = [
    {
        id: 'p1',
        title: 'Hello world',
        slug: 'hello-world',
        excerpt: 'First words',
        blurbText: null,
        photoNote: null,
        photoAlbum: null,
        contentType: 'blog',
        status: 'published',
        authorId: 'u1',
        author: { id: 'u1', name: 'Ada', image: null },
        isFeatured: false,
        readingTimeMinutes: 3,
        publishAt: null,
        publishedAt: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
    },
    {
        id: 'p2',
        title: 'A thought',
        slug: 'a-thought',
        excerpt: null,
        blurbText: 'Rain again today.',
        photoNote: null,
        photoAlbum: null,
        contentType: 'blurb',
        status: 'draft',
        authorId: 'u1',
        author: null,
        isFeatured: false,
        readingTimeMinutes: null,
        publishAt: null,
        publishedAt: null,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
    },
];
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };
const listCalls = () =>
    apiClient.mock.calls.map(([url]) => url as string).filter((u) => u.startsWith('/api/ottaorm/posts?'));

function renderPage() {
    return render(
        <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
            <AdminBlogListPage />
        </OttaQueryProvider>,
    );
}

describe('AdminBlogListPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (options?.method === 'PATCH') return { ...posts[0], isFeatured: true };
            return {
                data: posts,
                pagination: { page: 1, perPage: 20, total: 2, totalPages: 1, next: null, prev: null },
            };
        });
    });

    it('lists every kind of post newest first, and a row opens the editor', async () => {
        renderPage();
        expect(await screen.findByText('Hello world')).toBeInTheDocument();
        expect(listCalls()[0]).toBe('/api/ottaorm/posts?page=1&perPage=20&orderBy=updatedAt&orderDirection=desc');
        const first = within(screen.getByText('Hello world').closest('tr')!);
        expect(first.getByText('Published')).toBeInTheDocument();
        expect(first.getByText('Blog Post')).toBeInTheDocument();
        expect(first.getByText('First words')).toBeInTheDocument();
        expect(first.getByText('Ada')).toBeInTheDocument();
        const second = within(screen.getByText('Rain again today.').closest('tr')!);
        expect(second.getByText('Draft')).toBeInTheDocument();
        expect(second.getByText('Blurb')).toBeInTheDocument();
        expect(second.queryByRole('button', { name: 'View' })).toBeNull();
        expect(screen.getByRole('link', { name: 'Hello world' })).toHaveAttribute(
            'href',
            '/admin/content/blog/p1/edit',
        );

        fireEvent.click(first.getByText('First words'));
        expect(navigate).toHaveBeenCalledWith({ to: '/admin/content/blog/p1/edit' });
    });

    it('filters by type and status on the server, and highlights in place', async () => {
        renderPage();
        await screen.findByText('Hello world');

        fireEvent.click(screen.getByRole('button', { name: 'Blurb' }));
        await waitFor(() =>
            expect(listCalls().at(-1)).toContain(
                `where=${encodeURIComponent(JSON.stringify({ contentType: 'blurb' }))}`,
            ),
        );
        fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'draft' } });
        await waitFor(() =>
            expect(listCalls().at(-1)).toContain(
                `where=${encodeURIComponent(JSON.stringify({ status: 'draft', contentType: 'blurb' }))}`,
            ),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Highlight this post' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/ottaorm/posts/p1',
                expect.objectContaining({ method: 'PATCH', body: { isFeatured: true } }),
            ),
        );
        expect(navigate).not.toHaveBeenCalled();
    });
});
