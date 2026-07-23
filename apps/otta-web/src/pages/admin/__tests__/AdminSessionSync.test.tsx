import { render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock('@/lib/auth', () => ({
    isOrgAdmin: () => true,
    isPlatformAdmin: () => true,
    useSession,
}));

vi.mock('@/ottabase/config/admin-nav', () => ({
    getEnabledAdminNav: () => [],
}));

vi.mock('@ottabase/ui-shadcn', () => ({
    Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useLocation: () => ({ pathname: '/admin' }),
}));

vi.mock('lucide-react', () => ({
    ArrowRight: () => null,
    LayoutDashboard: () => null,
    Search: () => null,
    X: () => null,
}));

import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminIndexPage } from '../AdminIndexPage';

describe('admin session synchronization', () => {
    beforeEach(() => {
        useSession.mockReset();
        useSession.mockReturnValue({ user: null });
    });

    it('leaves route-level session synchronization to ProtectedRoute', () => {
        render(
            <>
                <AdminLayout>Admin content</AdminLayout>
                <AdminIndexPage />
            </>,
        );

        expect(useSession).toHaveBeenCalledTimes(2);
        expect(useSession).toHaveBeenNthCalledWith(1, { skipAutoSync: true });
        expect(useSession).toHaveBeenNthCalledWith(2, { skipAutoSync: true });
    });
});
