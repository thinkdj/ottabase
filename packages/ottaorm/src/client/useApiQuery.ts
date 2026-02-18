// ============================================================
// @ottabase/ottaorm/client - Generic API Query Hooks
// ============================================================
// For custom endpoints that don't follow the model pattern.
//
// Cache invalidation convention:
//   - useApiQuery: pass `entity` to namespace the query key under
//     [entity, ...queryKey] — mutations auto-invalidate it.
//   - useApiMutation: pass `invalidateEntities` to invalidate one
//     or more entity namespaces when the mutation settles.
// ============================================================

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryOptions,
    type UseMutationOptions,
    type QueryKey,
} from '@tanstack/react-query';
import { useApiClient } from './QueryProvider';

/**
 * Generic API query hook for custom endpoints.
 *
 * Pass `entity` to automatically namespace the query key under
 * [entity, ...queryKey], making it invalidatable by any mutation
 * for that entity without manual key coordination.
 *
 * @example
 * ```typescript
 * // Without entity (raw query key, no auto-invalidation)
 * const { data } = useApiQuery<Stats>({
 *   queryKey: ['stats', 'dashboard'],
 *   endpoint: '/api/stats/dashboard',
 * });
 *
 * // With entity (key becomes ['posts', 'list', { page }])
 * const { data } = useApiQuery<BlogListResponse>({
 *   entity: 'posts',
 *   queryKey: ['list', { page, contentType }],
 *   endpoint: `/api/blog/posts?page=${page}`,
 * });
 * ```
 */
export function useApiQuery<TData, TTransformed = TData>(options: {
    /** Entity name — namespaces queryKey as [entity, ...queryKey] for auto-invalidation */
    entity?: string;
    queryKey: QueryKey;
    endpoint: string;
    method?: 'GET' | 'POST';
    body?: unknown;
    transform?: (data: TData) => TTransformed;
    fetchOptions?: RequestInit;
    queryOptions?: Partial<UseQueryOptions<TTransformed, Error>>;
}) {
    const { entity, queryKey, endpoint, method = 'GET', body, transform, fetchOptions, queryOptions } = options;

    const apiClient = useApiClient();

    // When entity is provided, namespace the key under [entity, ...queryKey]
    const resolvedKey: QueryKey = entity ? [entity, ...(Array.isArray(queryKey) ? queryKey : [queryKey])] : queryKey;

    return useQuery<TTransformed, Error>({
        queryKey: resolvedKey,
        queryFn: async (): Promise<TTransformed> => {
            // Use injected API client if available, otherwise fall back to raw fetch
            if (apiClient) {
                const data = await apiClient<TData>(endpoint, {
                    method,
                    body,
                });
                return (transform ? transform(data) : data) as TTransformed;
            }

            // Fallback to raw fetch for backward compatibility
            const response = await fetch(endpoint, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                ...fetchOptions,
            });

            if (!response.ok) {
                const error = (await response.json().catch(() => ({}))) as {
                    error?: string;
                    message?: string;
                };
                throw new Error(error.error || error.message || 'Request failed');
            }

            const data = (await response.json()) as TData;
            return (transform ? transform(data) : data) as TTransformed;
        },
        ...queryOptions,
    });
}

/**
 * Generic API mutation hook for custom endpoints.
 *
 * Use `invalidateEntities` to invalidate entire entity namespaces on settled,
 * or `invalidateKeys` for raw key invalidation.
 *
 * @example
 * ```typescript
 * // Invalidate by entity (preferred — works with any query using that entity)
 * const mutation = useApiMutation<{ success: boolean }, FormData>({
 *   endpoint: '/api/custom-action',
 *   method: 'POST',
 *   invalidateEntities: ['posts', 'series'],
 * });
 *
 * // Invalidate by raw key (legacy)
 * const mutation = useApiMutation({
 *   endpoint: '/api/ottaorm/init',
 *   method: 'POST',
 *   invalidateKeys: [['users'], ['posts']],
 * });
 * ```
 */
export function useApiMutation<TData, TVariables = unknown>(options: {
    endpoint: string | ((variables: TVariables) => string);
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Entity names whose full cache namespace to invalidate on settled */
    invalidateEntities?: string[];
    /** Raw query keys to invalidate on settled (legacy — prefer invalidateEntities) */
    invalidateKeys?: QueryKey[];
    mutationOptions?: Partial<UseMutationOptions<TData, Error, TVariables>>;
}) {
    const { endpoint, method = 'POST', invalidateEntities = [], invalidateKeys = [], mutationOptions } = options;
    const queryClient = useQueryClient();
    const apiClient = useApiClient();

    return useMutation<TData, Error, TVariables>({
        mutationFn: async (variables): Promise<TData> => {
            const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint;

            // Use injected API client if available
            if (apiClient) {
                return await apiClient<TData>(url, {
                    method,
                    body: method !== 'DELETE' ? variables : undefined,
                });
            }

            // Fallback to raw fetch for backward compatibility
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: method !== 'DELETE' ? JSON.stringify(variables) : undefined,
            });

            if (!response.ok) {
                const error = (await response.json().catch(() => ({}))) as {
                    error?: string;
                    message?: string;
                };
                throw new Error(error.error || error.message || 'Request failed');
            }

            return response.json() as Promise<TData>;
        },
        onSuccess: (...args) => {
            // Invalidate by entity namespace (preferred)
            for (const entity of invalidateEntities) {
                queryClient.invalidateQueries({ queryKey: [entity] });
            }
            // Invalidate by raw key (legacy)
            for (const key of invalidateKeys) {
                queryClient.invalidateQueries({ queryKey: key });
            }
            mutationOptions?.onSuccess?.(...args);
        },
        ...mutationOptions,
    });
}

/**
 * Hook for batch operations
 *
 * @example
 * ```typescript
 * const batchDelete = useBatchMutation<boolean, string[]>({
 *   endpoint: '/api/users/batch-delete',
 *   invalidateEntities: ['users'],
 * });
 *
 * batchDelete.mutate(['id1', 'id2', 'id3']);
 * ```
 */
export function useBatchMutation<TData, TVariables extends unknown[]>(options: {
    endpoint: string;
    method?: 'POST' | 'DELETE';
    invalidateEntities?: string[];
    invalidateKeys?: QueryKey[];
    mutationOptions?: Partial<UseMutationOptions<TData, Error, TVariables>>;
}) {
    return useApiMutation<TData, TVariables>(options);
}
