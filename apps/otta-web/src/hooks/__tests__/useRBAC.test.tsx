import { createModelHooks, OttaQueryProvider } from '@ottabase/ottaorm/client';
import { useQueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationRecord } from '@/types/rbac';

const mocks = vi.hoisted(() => ({
    api: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    useSession: () => ({ user: null, refreshSession: vi.fn() }),
}));

import { useCreateOrganization, useDeleteOrganization, useUpdateOrganization } from '../useRBAC';

// Same entityName as useRBAC's internal `organizationHooks` — createModelHooks builds
// query keys as a pure function of entityName, so this instance's keys are equal to
// (though not the same reference as) the ones the hooks under test invalidate.
const organizationQueryKeys = createModelHooks<OrganizationRecord>({ entityName: 'organizations' }).queryKeys;

function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <OttaQueryProvider
                apiClient={mocks.api}
                visibilityScope={{
                    appId: 'test-app',
                    organizationId: 'test-org',
                    principalId: 'test-user',
                }}
            >
                {children}
            </OttaQueryProvider>
        );
    };
}

/**
 * Regression coverage for the organization mutations losing their cache
 * reconciliation when the framework's global meta.entity mutation observer
 * was removed (see QueryProvider.tsx). Each hook below now owns its own
 * onSuccess invalidation instead of relying on that removed mechanism.
 */
describe('useRBAC organization mutations — post-success cache reconciliation', () => {
    beforeEach(() => {
        mocks.api.mockReset();
    });

    it('useCreateOrganization invalidates the organization list on success', async () => {
        mocks.api.mockResolvedValueOnce({ id: 'org-real', name: 'Acme' });
        const { result } = renderHook(() => ({ queryClient: useQueryClient(), mutation: useCreateOrganization() }), {
            wrapper: createWrapper(),
        });
        result.current.queryClient.setQueryData(organizationQueryKeys.lists(), []);

        await result.current.mutation.mutateAsync({ name: 'Acme' });

        // Creation is not shown optimistically because the server must provision the
        // owner membership before the tenant is usable.
        expect(result.current.queryClient.getQueryState(organizationQueryKeys.lists())?.isInvalidated).toBe(true);
    });

    it('useUpdateOrganization invalidates the detail (by canonical id) and list caches on success', async () => {
        mocks.api.mockResolvedValueOnce({ id: 'org-1', name: 'Acme Renamed' });
        const { result } = renderHook(() => ({ queryClient: useQueryClient(), mutation: useUpdateOrganization() }), {
            wrapper: createWrapper(),
        });
        result.current.queryClient.setQueryData(organizationQueryKeys.detail('org-1'), {
            id: 'org-1',
            name: 'Acme',
        });
        result.current.queryClient.setQueryData(organizationQueryKeys.lists(), [{ id: 'org-1', name: 'Acme' }]);

        await result.current.mutation.mutateAsync({ id: 'org-1', data: { name: 'Acme Renamed' } });

        expect(result.current.queryClient.getQueryState(organizationQueryKeys.detail('org-1'))?.isInvalidated).toBe(
            true,
        );
        expect(result.current.queryClient.getQueryState(organizationQueryKeys.lists())?.isInvalidated).toBe(true);
    });

    it('useDeleteOrganization removes the deleted detail entry and invalidates the list on success', async () => {
        mocks.api.mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => ({ queryClient: useQueryClient(), mutation: useDeleteOrganization() }), {
            wrapper: createWrapper(),
        });
        result.current.queryClient.setQueryData(organizationQueryKeys.detail('org-1'), {
            id: 'org-1',
            name: 'Acme',
        });
        result.current.queryClient.setQueryData(organizationQueryKeys.lists(), [{ id: 'org-1', name: 'Acme' }]);

        await result.current.mutation.mutateAsync('org-1');

        expect(result.current.queryClient.getQueryData(organizationQueryKeys.detail('org-1'))).toBeUndefined();
        expect(result.current.queryClient.getQueryState(organizationQueryKeys.lists())?.isInvalidated).toBe(true);
    });
});
