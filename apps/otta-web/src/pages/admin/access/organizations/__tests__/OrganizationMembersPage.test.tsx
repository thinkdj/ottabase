import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    useParams: vi.fn(() => ({ organizationId: 'org-123' })),
    useOrganizationMembers: vi.fn(),
    updateRole: vi.fn(),
    updateStatus: vi.fn(),
    remove: vi.fn(),
    setOrganizationId: vi.fn(),
}));

const members = [
    {
        id: 'm1',
        userId: 'u1',
        organizationId: 'org-123',
        role: 'member',
        status: 'active',
        joinedAt: '2026-01-02T00:00:00Z',
        user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', image: null },
    },
    {
        id: 'm2',
        userId: null,
        invitedEmail: 'new@example.com',
        organizationId: 'org-123',
        role: 'member',
        status: 'invited',
        invitedAt: '2026-01-03T00:00:00Z',
    },
];

vi.mock('@/hooks/useRBAC', () => ({
    useOrganization: () => ({ data: { id: 'org-123', name: 'Acme' } }),
    useOrganizationMembers: mocks.useOrganizationMembers,
    useInviteMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateMemberRole: () => ({ mutate: mocks.updateRole, isPending: false }),
    useUpdateMemberStatus: () => ({ mutate: mocks.updateStatus, isPending: false }),
    useRemoveMember: () => ({ mutate: mocks.remove, isPending: false }),
}));
vi.mock('@/hooks/useToast', () => ({
    useRBACToast: () => ({
        error: vi.fn(),
        rbac: { memberRemoved: vi.fn(), memberUpdated: vi.fn(), memberInvited: vi.fn() },
    }),
}));
vi.mock('@/lib/api', () => ({ isApiError: () => false }));
vi.mock('@/ottabase/state/appState', () => ({ organizationIdAtom: {} }));
vi.mock('jotai', () => ({ useSetAtom: () => mocks.setOrganizationId }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useParams: mocks.useParams,
}));
vi.mock('../components/InviteMemberForm', () => ({
    InviteMemberForm: () => <div data-testid="invite-member-form" />,
}));

import { OrganizationMembersPage } from '../OrganizationMembersPage';

describe('OrganizationMembersPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useOrganizationMembers.mockReturnValue({
            data: {
                data: members,
                pagination: { page: 1, perPage: 25, total: 2, totalPages: 1, next: null, prev: null },
            },
            isLoading: false,
            error: null,
        });
    });

    it('reads the organization from the route and links back to the list', () => {
        render(<OrganizationMembersPage />);
        expect(mocks.useParams).toHaveBeenCalledWith({ strict: false });
        expect(mocks.useOrganizationMembers).toHaveBeenCalledWith('org-123', 1, 25);
        expect(mocks.setOrganizationId).toHaveBeenCalledWith('org-123');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme');
        expect(screen.getByRole('link', { name: 'Back to Organizations' })).toHaveAttribute(
            'href',
            '/admin/access/organizations',
        );
    });

    it('changes a role in place and leaves open invites alone', async () => {
        render(<OrganizationMembersPage />);
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Pending invite')).toBeInTheDocument();
        expect(screen.getByText('new@example.com')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Role of Ada Lovelace'), { target: { value: 'admin' } });
        expect(mocks.updateRole).toHaveBeenCalledWith(
            { userId: 'u1', role: 'admin', organizationId: 'org-123' },
            expect.anything(),
        );
        expect(screen.getByLabelText('Role of new@example.com')).toBeDisabled();
        expect(screen.getAllByRole('button', { name: 'Edit' })[1]).toBeDisabled();

        fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
        expect(await screen.findByText('Cancel this invite?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel invite' }));
        await waitFor(() =>
            expect(mocks.remove).toHaveBeenCalledWith(
                { memberId: 'm2', userId: undefined, organizationId: 'org-123' },
                expect.anything(),
            ),
        );
    });
});
