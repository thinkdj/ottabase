import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    deleteMutate: vi.fn(),
    organizations: [
        {
            id: 'o1',
            name: 'Acme',
            slug: 'acme',
            plan: 'pro',
            status: 'active',
            ownerId: 'u1',
            createdAt: '2026-01-02T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
        },
        {
            id: 'o2',
            name: 'Globex',
            slug: 'globex',
            plan: 'free',
            status: 'suspended',
            ownerId: 'u2',
            createdAt: '2026-02-02T00:00:00Z',
            updatedAt: '2026-02-02T00:00:00Z',
        },
    ],
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/useRBAC', () => ({
    useOrganizations: () => ({ data: mocks.organizations, isLoading: false, error: null }),
    useCreateOrganization: () => ({ mutateAsync: vi.fn() }),
    useUpdateOrganization: () => ({ mutateAsync: vi.fn() }),
    useDeleteOrganization: () => ({ mutate: mocks.deleteMutate, isPending: false }),
}));
vi.mock('@/hooks/useToast', () => ({
    useRBACToast: () => ({
        error: vi.fn(),
        rbac: { organizationCreated: vi.fn(), organizationUpdated: vi.fn(), organizationDeleted: vi.fn() },
    }),
}));
vi.mock('@/lib/api', () => ({ isApiError: () => false }));
vi.mock('../components/OrganizationForm', () => ({
    OrganizationForm: ({ organization }: { organization: { name: string } | null }) => (
        <div data-testid="org-form">{organization ? `editing ${organization.name}` : 'new'}</div>
    ),
}));

import { OrganizationsPage } from '../OrganizationsPage';

describe('OrganizationsPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lists tenants with plan and state, filters as you type and opens members on click', async () => {
        render(<OrganizationsPage />);
        expect(screen.getByText('Acme')).toBeInTheDocument();
        expect(screen.getByText('pro')).toBeInTheDocument();
        expect(screen.getByText('suspended')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search by name, slug, plan or status'), {
            target: { value: 'glob' },
        });
        await waitFor(() => expect(screen.queryByText('Acme')).not.toBeInTheDocument());
        expect(screen.getByText('Globex')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Globex'));
        expect(mocks.navigate).toHaveBeenCalledWith({
            to: '/admin/access/organizations/$organizationId/members',
            params: { organizationId: 'o2' },
        });
    });

    it('edits in a dialog without opening the row', async () => {
        render(<OrganizationsPage />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
        expect(await screen.findByTestId('org-form')).toHaveTextContent('editing Acme');
        expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('deletes after confirming', async () => {
        render(<OrganizationsPage />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
        expect(await screen.findByText('Delete Globex?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(mocks.deleteMutate).toHaveBeenCalledWith('o2', expect.anything()));
    });
});
