// @vitest-environment jsdom

import { render, renderHook, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createModelHooks } from '../createModelHooks';
import { OttaQueryProvider, useApiClient, type VisibilityScope } from '../QueryProvider';
import type { ApiClientFunction } from '../types';
import { useApiMutation, useApiQuery } from '../useApiQuery';

const scopeA: VisibilityScope = {
    appId: 'app',
    organizationId: 'org-a',
    principalId: 'user',
    authorizationVersion: 1,
};

function asApiClient(fn: ReturnType<typeof vi.fn>): ApiClientFunction {
    return fn as unknown as ApiClientFunction;
}

function createWrapper(apiClient: ApiClientFunction, visibilityScope: VisibilityScope = scopeA) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <OttaQueryProvider apiClient={apiClient} visibilityScope={visibilityScope}>
                {children}
            </OttaQueryProvider>
        );
    };
}

describe('OttaQueryProvider scope isolation', () => {
    it('creates a fresh client and clears the previous scope cache', async () => {
        const apiClient = asApiClient(vi.fn());
        const clients: ReturnType<typeof useQueryClient>[] = [];

        function CaptureClient() {
            const client = useQueryClient();
            if (clients[clients.length - 1] !== client) clients.push(client);
            return null;
        }

        const { rerender } = render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scopeA}>
                <CaptureClient />
            </OttaQueryProvider>,
        );

        const firstClient = clients[0];
        firstClient.setQueryData(['private'], { organizationId: 'org-a' });

        rerender(
            <OttaQueryProvider
                apiClient={apiClient}
                visibilityScope={{
                    ...scopeA,
                    organizationId: 'org-b',
                }}
            >
                <CaptureClient />
            </OttaQueryProvider>,
        );

        await waitFor(() => expect(clients).toHaveLength(2));
        expect(clients[1]).not.toBe(firstClient);
        expect(firstClient.getQueryCache().getAll()).toHaveLength(0);
    });

    it('remounts existing query observers when the visibility scope changes', async () => {
        const apiFn = vi
            .fn()
            .mockResolvedValueOnce({ organizationId: 'org-a' })
            .mockResolvedValueOnce({ organizationId: 'org-b' });
        const apiClient = asApiClient(apiFn);
        const mountEvents: string[] = [];

        function ScopedQuery() {
            const query = useApiQuery<{ organizationId: string }>({
                queryKey: ['private'],
                endpoint: '/api/private',
            });

            React.useEffect(() => {
                mountEvents.push('mount');
                return () => {
                    mountEvents.push('unmount');
                };
            }, []);

            return <span>{query.data?.organizationId}</span>;
        }

        const { getByText, rerender } = render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scopeA}>
                <ScopedQuery />
            </OttaQueryProvider>,
        );

        await waitFor(() => expect(getByText('org-a')).toBeTruthy());

        rerender(
            <OttaQueryProvider
                apiClient={apiClient}
                visibilityScope={{
                    ...scopeA,
                    organizationId: 'org-b',
                }}
            >
                <ScopedQuery />
            </OttaQueryProvider>,
        );

        await waitFor(() => expect(getByText('org-b')).toBeTruthy());
        expect(apiFn).toHaveBeenCalledTimes(2);
        expect(mountEvents).toEqual(['mount', 'unmount', 'mount']);
    });

    it('fails fast when a request hook is outside the provider', () => {
        function MissingProvider() {
            useApiClient();
            return null;
        }

        expect(() => render(<MissingProvider />)).toThrow(/must be used within an OttaQueryProvider/);
    });
});

describe('generic API hooks', () => {
    it('keeps projections observer-local while sharing one cached GET', async () => {
        const apiFn = vi.fn().mockResolvedValue({ value: 7 });
        const wrapper = createWrapper(asApiClient(apiFn));

        const { result } = renderHook(
            () => ({
                number: useApiQuery<{ value: number }, number>({
                    queryKey: ['stats'],
                    endpoint: '/api/stats',
                    select: (data) => data.value,
                }),
                label: useApiQuery<{ value: number }, string>({
                    queryKey: ['stats'],
                    endpoint: '/api/stats',
                    select: (data) => `value:${data.value}`,
                }),
            }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.number.data).toBe(7));
        expect(result.current.label.data).toBe('value:7');
        expect(apiFn).toHaveBeenCalledTimes(1);
        expect(apiFn).toHaveBeenCalledWith('/api/stats', {
            method: 'GET',
            signal: expect.any(AbortSignal),
        });
    });

    it('enforces the framework retry policy after consumer query options', async () => {
        const forbidden = Object.assign(new Error('Forbidden'), {
            name: 'ApiError' as const,
            status: 403,
            messages: ['Forbidden'],
            retryable: false,
        });
        const apiFn = vi.fn().mockRejectedValue(forbidden);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <React.StrictMode>
                <OttaQueryProvider apiClient={asApiClient(apiFn)} visibilityScope={scopeA}>
                    {children}
                </OttaQueryProvider>
            </React.StrictMode>
        );

        const { result } = renderHook(
            () =>
                useApiQuery({
                    queryKey: ['forbidden'],
                    endpoint: '/api/forbidden',
                    // Runtime defense-in-depth: even an untyped caller cannot
                    // replace the framework retry budget.
                    queryOptions: { retry: 2 } as never,
                }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(apiFn).toHaveBeenCalledTimes(1);
    });

    it('still aborts a request on a real unmount after the StrictMode-safe mount grace', async () => {
        const apiFn = vi.fn(
            (_endpoint: string, options?: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
                        once: true,
                    });
                }),
        );
        const wrapper = createWrapper(asApiClient(apiFn));
        const { unmount } = renderHook(
            () =>
                useApiQuery({
                    queryKey: ['cancellable'],
                    endpoint: '/api/cancellable',
                }),
            { wrapper },
        );

        await waitFor(() => expect(apiFn).toHaveBeenCalledTimes(1));
        const signal = (apiFn.mock.calls[0]?.[1] as { signal?: AbortSignal } | undefined)?.signal;
        expect(signal?.aborted).toBe(false);

        unmount();

        await waitFor(() => expect(signal?.aborted).toBe(true));
    });

    it('never repeats a mutation even when an untyped caller supplies retry options', async () => {
        const unavailable = Object.assign(new Error('Unavailable'), {
            name: 'ApiError' as const,
            status: 503,
            messages: ['Unavailable'],
            retryable: true,
        });
        const apiFn = vi.fn().mockRejectedValue(unavailable);
        const wrapper = createWrapper(asApiClient(apiFn));

        const { result } = renderHook(
            () =>
                useApiMutation<unknown, { name: string }>({
                    endpoint: '/api/items',
                    mutationOptions: { retry: 2 } as never,
                }),
            { wrapper },
        );

        await expect(result.current.mutateAsync({ name: 'one' })).rejects.toBe(unavailable);
        expect(apiFn).toHaveBeenCalledTimes(1);
    });

    it('reports model update failures even though the hook installs an internal rollback callback', async () => {
        const forbidden = Object.assign(new Error('Forbidden'), {
            name: 'ApiError' as const,
            status: 403,
            messages: ['Forbidden'],
            retryable: false,
        });
        const apiFn = vi.fn().mockRejectedValue(forbidden);
        const reporter = vi.fn();
        const hooks = createModelHooks<{ id: string; name: string }>({ entityName: 'items' });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <OttaQueryProvider apiClient={asApiClient(apiFn)} visibilityScope={scopeA} errorReporter={reporter}>
                {children}
            </OttaQueryProvider>
        );

        const { result } = renderHook(() => hooks.useUpdate(), { wrapper });

        await expect(result.current.mutateAsync({ id: 'one', data: { name: 'changed' } })).rejects.toBe(forbidden);
        expect(apiFn).toHaveBeenCalledTimes(1);
        expect(reporter).toHaveBeenCalledTimes(1);
    });

    it('preserves framework invalidation when a consumer supplies onSuccess', async () => {
        const apiFn = vi.fn().mockResolvedValue({ id: 'new-user' });
        const onSuccess = vi.fn();
        const wrapper = createWrapper(asApiClient(apiFn));

        const { result } = renderHook(
            () => {
                const queryClient = useQueryClient();
                const mutation = useApiMutation<{ id: string }, { name: string }>({
                    endpoint: '/api/users',
                    invalidateEntities: ['users'],
                    mutationOptions: { onSuccess },
                });
                return { queryClient, mutation };
            },
            { wrapper },
        );

        result.current.queryClient.setQueryData(['users', 'list'], []);
        await result.current.mutation.mutateAsync({ name: 'Ada' });

        expect(result.current.queryClient.getQueryState(['users', 'list'])?.isInvalidated).toBe(true);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(apiFn).toHaveBeenCalledWith('/api/users', {
            method: 'POST',
            body: { name: 'Ada' },
        });
    });
});
