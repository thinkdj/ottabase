import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient } = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock('@/lib/auth', () => ({
    useSession: () => ({ user: { id: 'u1', platformAdmin: true, permissions: ['*:*'] } }),
    isPlatformAdmin: () => true,
    isOrgAdmin: () => true,
}));
vi.mock('@/ottabase/config', () => ({ PACKAGES_ENABLED: { comments: true, ottablog: true } }));
vi.mock('@/ottabase/config/admin-nav', () => ({
    getEnabledAdminNav: () => [
        {
            id: 'content',
            label: 'Content',
            icon: () => null,
            items: [
                {
                    title: 'Posts',
                    description: 'Every post of every type.',
                    href: '/admin/content/blog',
                    icon: () => null,
                },
            ],
        },
    ],
}));
vi.mock('@/pages/admin/content/blog/blogAdminPaths', () => ({
    getPublicContentPath: (slug: string) => `/blog/${slug}`,
}));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

import { AdminIndexPage } from '../AdminIndexPage';

const paged = (total: number) => ({
    data: [],
    pagination: { page: 1, perPage: 1, total, totalPages: 1, next: null, prev: null },
});
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

function renderPage() {
    return render(
        <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
            <AdminIndexPage />
        </OttaQueryProvider>,
    );
}

describe('AdminIndexPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('leads with what is waiting, then counts, activity and the section list', async () => {
        apiClient.mockImplementation(async (url: string) => {
            if (url.startsWith('/api/admin/comments/flagged')) {
                return {
                    total: 2,
                    comments: [
                        {
                            id: 'c1',
                            body: 'Buy pills',
                            createdAt: 1,
                            author: { id: 'u2', name: 'Spammer' },
                            post: { id: 'p1', title: 'Hello', slug: 'hello', contentType: 'blog' },
                        },
                    ],
                };
            }
            if (url.startsWith('/api/ottaorm/posts')) {
                if (url.includes('scheduled')) return paged(3);
                return paged(url.includes('publishedAt') ? 2 : 40);
            }
            if (url.startsWith('/api/admin/users')) return paged(120);
            if (url.startsWith('/api/ottaorm/organizations')) return paged(4);
            if (url === '/api/admin/queues') return { stats: { totalDLQ: 1 } };
            if (url === '/api/system/kill-switches') return { readonly: true, lockdown: false };
            if (url.startsWith('/api/audit/logs')) {
                return {
                    data: [
                        {
                            id: 'a1',
                            user_id: 'u1',
                            user_email: 'ada@example.com',
                            action: 'update',
                            resource_type: 'post',
                            status: 'success',
                            created_at: Date.now() - 3_600_000,
                        },
                    ],
                    pagination: paged(1).pagination,
                };
            }
            throw new Error(`unexpected ${url}`);
        });
        renderPage();

        const flagged = await screen.findByRole('link', { name: '2 comments flagged by readers' });
        expect(flagged).toHaveAttribute('href', '/blog/hello');
        expect(screen.getByRole('link', { name: 'Spammer: Buy pills' })).toHaveAttribute('href', '/blog/hello');
        expect(screen.getByRole('link', { name: '1 job in the dead-letter queue' })).toHaveAttribute(
            'href',
            '/admin/infrastructure/queues',
        );
        expect(screen.getByRole('link', { name: 'Read-only mode is on: nothing can be saved' })).toHaveAttribute(
            'href',
            '/admin/security/kill-switches',
        );
        expect(screen.getByText('3 posts scheduled to publish')).toBeInTheDocument();
        expect(screen.queryByText(/Lockdown/)).not.toBeInTheDocument();

        expect(await screen.findByText('120')).toBeInTheDocument();
        expect(screen.getByText('Organizations')).toBeInTheDocument();
        expect(screen.getByText('Published this week').nextSibling).toHaveTextContent('2');

        expect(await screen.findByText('ada@example.com updated post')).toBeInTheDocument();
        expect(screen.getByText('1h ago')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'All activity' })).toHaveAttribute('href', '/admin/security/audit');
        expect(screen.getByRole('link', { name: /Posts/ })).toHaveAttribute('href', '/admin/content/blog');
    });

    it('says so when nothing is waiting', async () => {
        apiClient.mockImplementation(async (url: string) => {
            if (url.startsWith('/api/admin/comments/flagged')) return { total: 0, comments: [] };
            if (url === '/api/admin/queues') return { stats: { totalDLQ: 0 } };
            if (url === '/api/system/kill-switches') return { readonly: false, lockdown: false };
            if (url.startsWith('/api/audit/logs')) return paged(0);
            return paged(0);
        });
        renderPage();
        expect(await screen.findByText('All clear. Nothing is waiting on you.')).toBeInTheDocument();
        expect(screen.getByText('Nothing recorded yet.')).toBeInTheDocument();
    });
});
