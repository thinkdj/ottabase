import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, rememberReturnPath, session } = vi.hoisted(() => ({
    navigate: vi.fn(),
    rememberReturnPath: vi.fn(),
    session: {
        isAuthenticated: true,
        isInitialized: false,
        user: { id: 'user-1', email: 'owner@example.com', permissions: ['org:admin'] },
    },
}));

vi.mock('@/lib/auth', () => ({
    isPlatformAdmin: () => false,
    useSession: () => session,
}));

vi.mock('@/lib/auth-redirect', () => ({ rememberReturnPath }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

vi.mock('@ottabase/ui-shadcn', () => ({ Spinner: () => <span>spinner</span> }));

import { ProtectedRoute } from '../ProtectedRoute';

describe('ProtectedRoute', () => {
    beforeEach(() => {
        navigate.mockReset();
        rememberReturnPath.mockReset();
        session.isAuthenticated = true;
        session.isInitialized = false;
        session.user = { id: 'user-1', email: 'owner@example.com', permissions: ['org:admin'] };
    });

    it('waits for the root bootstrap instead of refreshing when an admin route mounts', async () => {
        const { rerender } = render(
            <ProtectedRoute requiredPermissions={['org:admin']}>
                <div>Admin content</div>
            </ProtectedRoute>,
        );

        expect(screen.getByText('Checking authentication...')).toBeTruthy();
        expect(navigate).not.toHaveBeenCalled();

        session.isInitialized = true;
        rerender(
            <ProtectedRoute requiredPermissions={['org:admin']}>
                <div>Admin content</div>
            </ProtectedRoute>,
        );

        await waitFor(() => expect(screen.getByText('Admin content')).toBeTruthy());
        expect(navigate).not.toHaveBeenCalled();
    });
});
