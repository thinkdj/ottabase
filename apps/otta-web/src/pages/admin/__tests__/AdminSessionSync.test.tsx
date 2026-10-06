import { OttaQueryProvider } from '@ottabase/ottaorm/client';
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

vi.mock('@/ottabase/config', () => ({ PACKAGES_ENABLED: {}, APP_META: { appName: 'Ottabase' } }));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useLocation: () => ({ pathname: '/admin' }),
}));

import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminIndexPage } from '../AdminIndexPage';

describe('admin session synchronization', () => {
    beforeEach(() => {
        useSession.mockReset();
        useSession.mockReturnValue({ user: null });
    });

    it('reads the shared session without initiating another sync', () => {
        render(
            <OttaQueryProvider
                apiClient={vi.fn().mockResolvedValue({})}
                visibilityScope={{ appId: 'app', organizationId: null, principalId: null }}
            >
                <AdminLayout>Admin content</AdminLayout>
                <AdminIndexPage />
            </OttaQueryProvider>,
        );

        expect(useSession).toHaveBeenCalledTimes(2);
        expect(useSession).toHaveBeenNthCalledWith(1);
        expect(useSession).toHaveBeenNthCalledWith(2);
    });
});
