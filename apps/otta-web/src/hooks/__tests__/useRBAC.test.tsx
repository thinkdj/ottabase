import { createModelHooks } from '@ottabase/ottaorm/client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationRecord } from '@/types/rbac';

const mocks = vi.hoisted(() => ({
    api: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
    api: mocks.api,
}));

vi.mock('@/lib/auth', () => ({
    useSession: () => ({ user: null, refreshSession: vi.fn() }),
}));

import { useCreateOrganization, useDeleteOrganization, useUpdateOrganization } from '../useRBAC';

// Same entityName as useRBAC's internal `organizationHooks` — createModelHooks builds
// query keys as a pure function of entityName, so this instance's keys are equal to
// (though not the same reference as) the ones the hooks under test invalidate.
const organizationQueryKeys = createModelHooks<OrganizationRecord>({ entityName: 'organizations' }).queryKeys;

function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

/**
 * Regression coverage for the organization mutations losing their cache
 * reconciliation when the framework's global meta.entity mutation observer
 * was removed (see QueryProvider.tsx). Each hook below now owns its own
 * onSuccess invalidation instead of relying on that removed mechanism.
 */
describe('useRBAC organization mutations — post-success cache reconciliation', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        mocks.api.mockReset();
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
    });

    it('useCreateOrganization invalidates the organization list on success', async () => {
        mocks.api.mockResolvedValueOnce({ data: { id: 'org-real', name: 'Acme' } });
        queryClient.setQueryData(organizationQueryKeys.lists(), []);

        const { result } = renderHook(() => ({ queryClient: useQueryClient(), mutation: useCreateOrganization() }), {
            wrapper: createWrapper(queryClient),
        });

        await result.current.mutation.mutateAsync({ name: 'Acme' });

        // Without this invalidation the optimistic temp-<timestamp> row from onMutate
        // would never be reconciled with the server's real id.
        expect(result.current.queryClient.getQueryState(organizationQueryKeys.lists())?.isInvalidated).toBe(true);
    });

    it('useUpdateOrganization invalidates the detail (by canonical id) and list caches on success', async () => {
        mocks.api.mockResolvedValueOnce({ data: { id: 'org-1', name: 'Acme Renamed' } });
        queryClient.setQueryData(organizationQueryKeys.detail('org-1'), { id: 'org-1', name: 'Acme' });
        queryClient.setQueryData(organizationQueryKeys.lists(), [{ id: 'org-1', name: 'Acme' }]);

        const { result } = renderHook(() => ({ queryClient: useQueryClient(), mutation: useUpdateOrganization() }), {
            wrapper: createWrapper(queryClient),
        });

        await result.current.mutation.mutateAsync({ id: 'org-1', data: { name: 'Acme Renamed' } });

        expect(result.current.queryClient.getQueryState(organizationQueryKeys.detail('org-1'))?.isInvalidated).toBe(
            true,
        );
        expect(result.current.queryClient.getQueryState(organizationQueryKeys.lists())?.isInvalidated).toBe(true);
    });

    it('useDeleteOrganization removes the deleted detail entry and invalidates the list on success', async () => {
        mocks.api.mockResolvedValueOnce(undefined);
        queryClient.setQueryData(organizationQueryKeys.detail('org-1'), { id: 'org-1', name: 'Acme' });
        queryClient.setQueryData(organizationQueryKeys.lists(), [{ id: 'org-1', name: 'Acme' }]);

        const { result } = renderHook(() => ({ queryClient: useQueryClient(), mutation: useDeleteOrganization() }), {
            wrapper: createWrapper(queryClient),
        });

        await result.current.mutation.mutateAsync('org-1');

        expect(result.current.queryClient.getQueryData(organizationQueryKeys.detail('org-1'))).toBeUndefined();
        expect(result.current.queryClient.getQueryState(organizationQueryKeys.lists())?.isInvalidated).toBe(true);
    });
});
