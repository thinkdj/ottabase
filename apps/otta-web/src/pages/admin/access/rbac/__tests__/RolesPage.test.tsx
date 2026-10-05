import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, search, updateMutateAsync, createMutateAsync, roles } = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: { value: {} as { role?: string } },
    updateMutateAsync: vi.fn(async () => ({})),
    createMutateAsync: vi.fn(async () => ({ id: 'r-new' })),
    roles: [
        {
            id: 'r-editor',
            name: 'editor',
            description: 'Writes posts',
            permissions: ['posts:create', 'posts:update'],
            isSystem: false,
            createdAt: '',
            updatedAt: '',
        },
        {
            id: 'r-owner',
            name: 'platform_owner',
            permissions: ['*:*'],
            isSystem: true,
            createdAt: '',
            updatedAt: '',
        },
    ],
}));

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigate,
    useSearch: () => search.value,
}));
vi.mock('@/hooks/useRBAC', () => ({
    useRoles: () => ({ data: roles, isLoading: false, error: null, refetch: vi.fn() }),
    useCreateRole: () => ({ mutateAsync: createMutateAsync, isPending: false }),
    useUpdateRole: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
    useDeleteRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useToast', () => ({
    useRBACToast: () => ({
        error: vi.fn(),
        rbac: { roleCreated: vi.fn(), roleUpdated: vi.fn(), roleDeleted: vi.fn() },
    }),
}));
vi.mock('@/hooks/useEditorLeaveGuard', () => ({
    useEditorLeaveGuard: () => ({ blocker: { status: 'idle' }, allowNavigateRef: { current: false } }),
}));
vi.mock('@/components/editor/UnsavedChangesDialog', () => ({ UnsavedChangesDialog: () => null }));
vi.mock('@/components/ErrorBoundary', () => ({ ApiErrorDisplay: () => null }));
vi.mock('@ottabase/ui-components', () => ({
    ConfirmDialog: () => null,
    EmptyState: ({ title }: any) => <p>{title}</p>,
    LoadingState: () => <p>Loading</p>,
}));
// Real kit, except a native checkbox so toBeChecked() and change events are plain
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ui-shadcn')>()),
    Checkbox: ({ onCheckedChange, checked, ...props }: any) => (
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...props} />
    ),
}));

import { RolesPage } from '../RolesPage';

describe('RolesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        search.value = {};
    });

    it('lists roles and asks to pick one', () => {
        render(<RolesPage />);
        expect(screen.getByRole('button', { name: /editor/ })).toBeInTheDocument();
        expect(screen.getByText('Pick a role')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /editor/ }));
        expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ search: { role: 'r-editor' } }));
    });

    it('saves a reviewed set of permissions, not every tick', async () => {
        search.value = { role: 'r-editor' };
        render(<RolesPage />);

        const publish = screen.getByLabelText(/Publish posts/);
        expect(publish).not.toBeChecked();
        fireEvent.click(publish);
        expect(screen.getByText(/adding 1 permission/)).toBeInTheDocument();
        expect(updateMutateAsync).not.toHaveBeenCalled();

        fireEvent.click(screen.getByLabelText(/Edit posts/));
        expect(screen.getByText(/adding 1, removing 1 permissions/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
        expect(updateMutateAsync).toHaveBeenCalledWith({
            id: 'r-editor',
            data: { name: 'editor', description: 'Writes posts', permissions: ['posts:create', 'posts:publish'] },
        });
    });

    it('shows wildcard-covered permissions as included and keeps system roles read-only', () => {
        search.value = { role: 'r-owner' };
        render(<RolesPage />);
        const publish = screen.getByLabelText(/Publish posts/);
        expect(publish).toBeChecked();
        expect(publish).toBeDisabled();
        expect(screen.getAllByText(/Included in/).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });

    it('creates a role from the new-role draft', async () => {
        search.value = { role: 'new' };
        render(<RolesPage />);
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reviewer' } });
        fireEvent.click(screen.getByLabelText(/Moderate comments/));
        fireEvent.click(screen.getByRole('button', { name: 'Create role' }));
        await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
        expect(createMutateAsync).toHaveBeenCalledWith({
            name: 'reviewer',
            description: '',
            permissions: ['comments:moderate'],
        });
        expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ search: { role: 'r-new' } }));
    });
});
