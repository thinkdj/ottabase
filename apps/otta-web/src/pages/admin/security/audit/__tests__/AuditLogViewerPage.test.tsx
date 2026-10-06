import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogRecord } from '@/types/rbac';

const mocks = vi.hoisted(() => ({
    search: {} as Record<string, unknown>,
    navigate: vi.fn(),
    apiClient: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useSearch: () => mocks.search, useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/useToast', () => ({ useRBACToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { AuditLogViewerPage } from '../AuditLogViewerPage';

const midnight = new Date().setHours(0, 0, 0, 0);
const rows: AuditLogRecord[] = [
    {
        id: 'l1',
        user_id: 'user_0123456789abcdef',
        user_email: 'ada@example.com',
        organization_id: 'org_0123456789abcdef',
        action: 'role.assign',
        resource_type: 'role',
        resource_id: 'role_0123456789abcdef',
        status: 'success',
        metadata: '{"method":"POST","roleName":"Editor"}',
        created_at: midnight + 3_600_000,
    },
    {
        id: 'l2',
        user_id: 'user_2',
        action: 'delete',
        resource_type: 'post',
        status: 'failure',
        error_message: 'Not allowed',
        created_at: midnight - 3_600_000,
    },
];
const response = {
    data: rows,
    pagination: { page: 1, perPage: 50, total: 2, totalPages: 1 },
    facets: {
        actions: [
            { value: 'role.assign', count: 1 },
            { value: 'delete', count: 1 },
        ],
        resourceTypes: [{ value: 'role', count: 1 }],
    },
};
const scope = { appId: 'app', organizationId: null, principalId: null };

/** What the page asked the URL to become */
const nextSearch = () => {
    const call = mocks.navigate.mock.calls.at(-1)?.[0] as { search: (prev: unknown) => unknown };
    return call.search(mocks.search);
};

function renderPage() {
    return render(
        <OttaQueryProvider apiClient={mocks.apiClient} visibilityScope={scope}>
            <AuditLogViewerPage />
        </OttaQueryProvider>,
    );
}

beforeEach(() => {
    mocks.search = {};
    mocks.navigate.mockReset();
    mocks.apiClient.mockReset().mockResolvedValue(response);
});

describe('AuditLogViewerPage', () => {
    it('shows the rows as a timeline by day with the facets as filter options', async () => {
        renderPage();
        expect(await screen.findByText('ada@example.com')).toBeTruthy();
        expect(screen.getByRole('heading', { name: /Today/ })).toBeTruthy();
        expect(screen.getByRole('heading', { name: /Yesterday/ })).toBeTruthy();
        expect(screen.getByText('role assign')).toBeTruthy();
        expect(screen.getByText('method: POST, roleName: Editor')).toBeTruthy();
        expect(screen.getByText('Not allowed')).toBeTruthy();
        expect(screen.getByRole('option', { name: 'role assign (1)' })).toBeTruthy();
        expect(screen.getByText('2 entries')).toBeTruthy();
        expect(mocks.apiClient.mock.calls[0][0]).toBe('/api/audit/logs?page=1&per_page=50');
    });

    it('follows a person or an organization, and filters by status, through the URL', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'ada@example.com' }));
        expect(nextSearch()).toEqual({ user: 'user_0123456789abcdef' });

        fireEvent.click(screen.getByRole('button', { name: /org org_0123/ }));
        expect(nextSearch()).toEqual({ org: 'org_0123456789abcdef' });

        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failure' } });
        expect(nextSearch()).toEqual({ status: 'failure' });
    });

    it('opens the details of an entry', async () => {
        renderPage();
        const toggle = await screen.findByRole('button', { name: /method: POST/ });
        fireEvent.click(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText(/"roleName": "Editor"/)).toBeTruthy();
        expect(screen.getByText('role_0123456789abcdef')).toBeTruthy();
    });

    it('shows the active id filters as removable chips and an honest empty state', async () => {
        mocks.search = { user: 'user_0123456789abcdef', status: 'error' };
        mocks.apiClient.mockResolvedValue({ ...response, data: [], pagination: { ...response.pagination, total: 0 } });
        renderPage();
        expect(await screen.findByText('Nothing matches these filters')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Remove User/ }));
        expect(nextSearch()).toEqual({ status: 'error' });
        await waitFor(() =>
            expect(mocks.apiClient.mock.calls[0][0]).toBe(
                '/api/audit/logs?page=1&per_page=50&status=error&userId=user_0123456789abcdef',
            ),
        );
    });
});
