import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, apiClient } = vi.hoisted(() => ({ navigate: vi.fn(), apiClient: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

import { NotificationsPage } from '../NotificationsPage';

const items = [
    {
        id: 'n1',
        title: 'Ada replied to your comment',
        message: 'Well said',
        category: 'comments',
        actionUrl: '/blog/hello',
        actionText: null,
        status: 'pending',
        readAt: null,
        createdAt: Date.now() - 60_000,
    },
    {
        id: 'n2',
        title: 'You were added to Acme',
        message: 'Grace made you a member.',
        category: 'organizations',
        actionUrl: null,
        actionText: null,
        status: 'read',
        readAt: Date.now(),
        createdAt: Date.now() - 3_600_000,
    },
];
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };
const listCalls = () =>
    apiClient.mock.calls.map(([url]) => url as string).filter((u) => u.startsWith('/api/notifications?'));

describe('NotificationsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (options?.method === 'POST') return { updated: 1 };
            const unreadOnly = url.includes('unread=1');
            const data = unreadOnly ? items.filter((item) => item.status !== 'read') : items;
            return {
                data,
                pagination: { page: 1, perPage: 20, total: data.length, totalPages: 1, next: null, prev: null },
                unread: 1,
            };
        });
        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
                <NotificationsPage />
            </OttaQueryProvider>,
        );
    });

    it('lists the inbox, filters to unread, and marks one read in place', async () => {
        expect(await screen.findByText('Ada replied to your comment')).toBeInTheDocument();
        expect(listCalls()[0]).toBe('/api/notifications?page=1&perPage=20');
        expect(screen.getByText('Organization')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Unread (1)' }));
        await waitFor(() => expect(listCalls().at(-1)).toBe('/api/notifications?page=1&perPage=20&unread=1'));
        await waitFor(() => expect(screen.queryByText('You were added to Acme')).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/notifications/read',
                expect.objectContaining({ method: 'POST', body: { ids: ['n1'] } }),
            ),
        );
        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens a notification where it points', async () => {
        fireEvent.click(await screen.findByText('Well said'));
        expect(navigate).toHaveBeenCalledWith({ to: '/blog/hello' });
    });
});
