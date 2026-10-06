import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, apiClient } = vi.hoisted(() => ({ navigate: vi.fn(), apiClient: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

import { UserManagementPage } from '../UserManagementPage';

const users = [
    {
        id: 'u1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        emailVerified: '2026-01-01T00:00:00Z',
        image: null,
        createdAt: '2026-01-02T00:00:00Z',
        role: 'admin',
    },
    {
        id: 'u2',
        name: null,
        email: 'bob@example.com',
        emailVerified: null,
        image: null,
        createdAt: '2026-02-02T00:00:00Z',
        role: 'user',
    },
];
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

function renderPage() {
    return render(
        <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
            <UserManagementPage />
        </OttaQueryProvider>,
    );
}

describe('UserManagementPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string) => {
            const search = new URL(url, 'http://x').searchParams.get('search');
            const data = search ? users.filter((u) => (u.email ?? '').includes(search)) : users;
            return {
                data,
                pagination: { page: 1, perPage: 25, total: data.length, totalPages: 1, next: null, prev: null },
                stats: { total: 2, admins: 1, verified: 1, newThisMonth: 2 },
            };
        });
    });

    it('lists everyone with their role and email state, and a row opens their access', async () => {
        renderPage();
        expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
        expect(apiClient).toHaveBeenCalledWith('/api/admin/users?page=1&perPage=25', expect.anything());
        expect(screen.getByText('Admin')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(screen.getByText('Unverified')).toBeInTheDocument();
        expect(screen.getByText('No name')).toBeInTheDocument();
        expect(screen.getByText('1 to 2 of 2')).toBeInTheDocument();
        // The counts strip above the table
        expect(screen.getByText('Platform admins').nextElementSibling).toHaveTextContent('1');
        expect(screen.getByText('New this month').nextElementSibling).toHaveTextContent('2');

        fireEvent.click(screen.getByText('Ada Lovelace'));
        expect(navigate).toHaveBeenCalledWith({ to: '/admin/access/users/$userId/rbac', params: { userId: 'u1' } });
    });

    it('searches once typing pauses', async () => {
        renderPage();
        await screen.findByText('Ada Lovelace');
        fireEvent.change(screen.getByPlaceholderText('Search by name or email'), { target: { value: 'bob' } });
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith('/api/admin/users?page=1&perPage=25&search=bob', expect.anything()),
        );
        await waitFor(() => expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument());
        expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });
});
