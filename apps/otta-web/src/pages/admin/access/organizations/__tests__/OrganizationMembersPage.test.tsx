import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const refetch = vi.fn();
    return {
        useParams: vi.fn(() => ({ organizationId: 'org-123' })),
        useAtomValue: vi.fn(() => 'org-current'),
        useOrganization: vi.fn(() => ({
            data: {
                id: 'org-123',
                name: 'Acme',
                slug: 'acme',
                plan: 'free',
                status: 'active',
                ownerId: 'u1',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            isLoading: false,
            error: null,
            refetch,
        })),
        useOrganizationMembers: vi.fn(() => ({
            data: {
                data: [],
                pagination: {
                    page: 1,
                    perPage: 25,
                    total: 0,
                    totalPages: 1,
                    next: null,
                    prev: null,
                },
            },
            isLoading: false,
            isRefetching: false,
            error: null,
            refetch,
        })),
        useInviteMember: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
        useUpdateMember: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
        useUpdateMemberRole: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
        useUpdateMemberStatus: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
        useRemoveMember: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
        useOrganizationPendingInvites: vi.fn(() => ({
            data: [],
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        })),
        useInviteByEmail: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
        useRevokeOrganizationInvite: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
        useResendOrganizationInvite: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
        useRBACToast: vi.fn(() => ({
            rbac: {
                memberRemoved: vi.fn(),
                memberUpdated: vi.fn(),
                memberInvited: vi.fn(),
            },
            error: vi.fn(),
            success: vi.fn(),
        })),
    };
});

vi.mock('@/hooks/useRBAC', () => ({
    useInviteMember: mocks.useInviteMember,
    useInviteByEmail: mocks.useInviteByEmail,
    useOrganization: mocks.useOrganization,
    useOrganizationMembers: mocks.useOrganizationMembers,
    useOrganizationPendingInvites: mocks.useOrganizationPendingInvites,
    useRemoveMember: mocks.useRemoveMember,
    useResendOrganizationInvite: mocks.useResendOrganizationInvite,
    useRevokeOrganizationInvite: mocks.useRevokeOrganizationInvite,
    useUpdateMember: mocks.useUpdateMember,
    useUpdateMemberRole: mocks.useUpdateMemberRole,
    useUpdateMemberStatus: mocks.useUpdateMemberStatus,
}));

vi.mock('@/hooks/useToast', () => ({
    useRBACToast: mocks.useRBACToast,
}));

vi.mock('@/hooks/useLastRefreshed', () => ({
    useLastRefreshed: () => ({
        label: 'Last refreshed just now',
        touch: vi.fn(),
    }),
}));

vi.mock('@/lib/api', () => ({
    isApiError: () => false,
}));

vi.mock('@/ottabase/state/appState', () => ({
    organizationIdAtom: {},
}));

vi.mock('jotai', () => ({
    useAtomValue: mocks.useAtomValue,
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useParams: mocks.useParams,
}));

vi.mock('@ottabase/ui-components', () => ({
    ConfirmDialog: () => null,
}));

vi.mock('@ottabase/ui-shadcn', () => {
    const Button = ({ asChild, children, ...props }: any) => {
        if (asChild) return children;
        return <button {...props}>{children}</button>;
    };
    const Div = ({ children }: any) => <div>{children}</div>;

    return {
        Button,
        Card: Div,
        CardContent: Div,
        CardDescription: Div,
        CardHeader: Div,
        CardTitle: ({ children }: any) => <h2>{children}</h2>,
        Dialog: Div,
        DialogContent: Div,
        DialogDescription: Div,
        DialogHeader: Div,
        DialogTitle: Div,
        Select: Div,
        SelectContent: Div,
        SelectItem: Div,
        SelectTrigger: Div,
        Table: Div,
        TableBody: Div,
        TableCell: Div,
        TableHead: Div,
        TableHeader: Div,
        TableRow: Div,
    };
});

vi.mock('@/components/ErrorBoundary', () => ({
    ApiErrorDisplay: () => null,
}));

vi.mock('@/components/LoadingSkeletons', () => ({
    TableSkeleton: () => null,
}));

vi.mock('../components/InviteMemberForm', () => ({
    InviteMemberForm: () => <div data-testid="invite-member-form" />,
}));

import { OrganizationMembersPage } from '../OrganizationMembersPage';

describe('OrganizationMembersPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the explicit organization id when rendering platform-admin tenant pages', () => {
        render(<OrganizationMembersPage />);

        expect(mocks.useParams).toHaveBeenCalledWith({ strict: false });
        expect(mocks.useOrganization).toHaveBeenCalledWith('org-123', { enabled: true });
        expect(mocks.useOrganizationMembers).toHaveBeenCalledWith('org-123', 1, 25, true);
    });

    it('renders the tenant-directory back link in platform mode', () => {
        render(<OrganizationMembersPage />);

        const backLink = screen.getByRole('link', { name: '← Back to Tenant Directory' });
        expect(backLink.getAttribute('href')).toBe('/admin/platform/organizations');
    });
});
