import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const refetch = vi.fn();
    return {
        useParams: vi.fn(() => ({ organizationId: 'org-123' })),
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
        useRBACToast: vi.fn(() => ({
            rbac: {
                memberRemoved: vi.fn(),
                memberUpdated: vi.fn(),
                memberInvited: vi.fn(),
            },
            error: vi.fn(),
        })),
        setOrganizationId: vi.fn(),
    };
});

vi.mock('@/hooks/useRBAC', () => ({
    useInviteMember: mocks.useInviteMember,
    useOrganizationMembers: mocks.useOrganizationMembers,
    useRemoveMember: mocks.useRemoveMember,
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
    useSetAtom: () => mocks.setOrganizationId,
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

    it('uses route params for organization context', () => {
        render(<OrganizationMembersPage />);

        expect(mocks.useParams).toHaveBeenCalledWith({ strict: false });
        expect(mocks.useOrganizationMembers).toHaveBeenCalledWith('org-123', 1);
        expect(mocks.setOrganizationId).toHaveBeenCalledWith('org-123');
    });

    it('renders back link to absolute organizations route', () => {
        render(<OrganizationMembersPage />);

        const backLink = screen.getByRole('link', { name: 'Back to Organizations' });
        expect(backLink).toHaveAttribute('href', '/admin/access/organizations');
    });
});
