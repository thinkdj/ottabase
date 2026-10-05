import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { NotificationBell } from '../NotificationBell';

const inbox = {
    data: [
        {
            id: 'n1',
            title: 'Ada replied to your comment',
            message: 'Well said',
            category: 'comments',
            actionUrl: '/blog/hello',
            actionText: 'See the reply',
            status: 'pending',
            readAt: null,
            createdAt: Date.now() - 60_000,
        },
        {
            id: 'n2',
            title: 'You were added to Acme',
            message: 'Grace made you a member.',
            category: 'organizations',
            actionUrl: '/dashboard',
            actionText: 'Open',
            status: 'read',
            readAt: Date.now(),
            createdAt: Date.now() - 3_600_000,
        },
    ],
    pagination: { page: 1, perPage: 8, total: 2, totalPages: 1, next: null, prev: null },
    unread: 1,
};
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

describe('NotificationBell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (options?.method === 'POST') return { updated: 1 };
            if (url.startsWith('/api/notifications?')) return inbox;
            throw new Error(`unexpected ${url}`);
        });
        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
                <NotificationBell />
            </OttaQueryProvider>,
        );
    });

    it('counts what is new and opens a notification where it points', async () => {
        const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
        expect(bell).toHaveTextContent('1');
        fireEvent.click(bell);
        expect(await screen.findByText('Ada replied to your comment')).toBeInTheDocument();
        expect(screen.getByText('You were added to Acme')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'All notifications' })).toHaveAttribute('href', '/notifications');

        fireEvent.click(screen.getByText('Ada replied to your comment'));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/notifications/read',
                expect.objectContaining({ method: 'POST', body: { ids: ['n1'] } }),
            ),
        );
        expect(navigate).toHaveBeenCalledWith({ to: '/blog/hello' });
    });

    it('marks everything read in one go', async () => {
        fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/notifications/read',
                expect.objectContaining({ method: 'POST', body: {} }),
            ),
        );
    });
});
