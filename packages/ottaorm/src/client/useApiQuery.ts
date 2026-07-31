// ============================================================
// @ottabase/ottaorm/client - Generic API Query Hooks
// ============================================================
// Custom endpoint hooks that share OttaORM cache namespaces
// ============================================================

import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryKey,
    type UseMutationOptions,
    type UseQueryOptions,
} from '@tanstack/react-query';
import {
    getStableQuerySignal,
    queryRetryDelay,
    shouldAutoRefetchQuery,
    shouldRetryQuery,
    useApiClient,
} from './QueryProvider';
import type { ApiClientError, ApiClientRequestOptions } from './types';

export interface ApiQueryOptions<TData, TSelected = TData> {
    /** Entity name used as an invalidation namespace. */
    entity?: string;
    queryKey: QueryKey;
    endpoint: string;
    /** Additional GET options. Method, body, and signal remain framework-owned. */
    requestOptions?: Omit<ApiClientRequestOptions, 'method' | 'body' | 'signal'>;
    /** Observer-local projection. Transformed data is never written into the shared cache. */
    select?: (data: TData) => TSelected;
    queryOptions?: Omit<
        UseQueryOptions<TData, ApiClientError, TSelected>,
        | 'queryKey'
        | 'queryFn'
        | 'select'
        | 'retry'
        | 'retryDelay'
        | 'refetchOnMount'
        | 'refetchOnWindowFocus'
        | 'refetchOnReconnect'
    >;
}

/**
 * Fetch a custom GET endpoint through the mandatory framework client.
 */
export function useApiQuery<TData, TSelected = TData>(options: ApiQueryOptions<TData, TSelected>) {
    const { entity, queryKey, endpoint, requestOptions, select, queryOptions } = options;
    const apiClient = useApiClient();
    const resolvedKey: QueryKey = entity ? [entity, ...queryKey] : queryKey;

    return useQuery<TData, ApiClientError, TSelected>({
        ...queryOptions,
        queryKey: resolvedKey,
        queryFn: async (context) =>
            apiClient<TData>(endpoint, {
                ...requestOptions,
                method: 'GET',
                signal: await getStableQuerySignal(context),
            }),
        select,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        refetchOnMount: shouldAutoRefetchQuery,
        refetchOnWindowFocus: shouldAutoRefetchQuery,
        refetchOnReconnect: shouldAutoRefetchQuery,
    });
}

export interface ApiMutationOptions<TData, TVariables, TContext = unknown> {
    endpoint: string | ((variables: TVariables) => string);
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Entity namespaces invalidated after a successful mutation. */
    invalidateEntities?: string[];
    /** Exact or prefix query keys invalidated after a successful mutation. */
    invalidateKeys?: QueryKey[];
    /** Additional request options. Method and body remain framework-owned. */
    requestOptions?: Omit<ApiClientRequestOptions, 'method' | 'body'>;
    mutationOptions?: Omit<
        UseMutationOptions<TData, ApiClientError, TVariables, TContext>,
        'mutationFn' | 'retry' | 'retryDelay'
    >;
}

/**
 * Execute a custom mutation without implicit retries or write deduplication.
 * Internal invalidation is composed with, and cannot be replaced by, consumer
 * lifecycle callbacks.
 */
export function useApiMutation<TData, TVariables = unknown, TContext = unknown>(
    options: ApiMutationOptions<TData, TVariables, TContext>,
) {
    const {
        endpoint,
        method = 'POST',
        invalidateEntities = [],
        invalidateKeys = [],
        requestOptions,
        mutationOptions,
    } = options;
    const queryClient = useQueryClient();
    const apiClient = useApiClient();
    const { onSuccess: consumerOnSuccess, ...consumerOptions } = mutationOptions ?? {};

    return useMutation<TData, ApiClientError, TVariables, TContext>({
        ...consumerOptions,
        retry: false,
        mutationFn: async (variables): Promise<TData> => {
            const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint;
            return apiClient<TData>(url, {
                ...requestOptions,
                method,
                body: method === 'DELETE' ? undefined : variables,
            });
        },
        onSuccess: async (data, variables, onMutateResult, mutationContext) => {
            for (const entity of invalidateEntities) {
                void queryClient.invalidateQueries({ queryKey: [entity] });
            }
            for (const key of invalidateKeys) {
                void queryClient.invalidateQueries({ queryKey: key });
            }
            await consumerOnSuccess?.(data, variables, onMutateResult, mutationContext);
        },
    });
}

export interface BatchMutationOptions<TData, TVariables extends unknown[], TContext = unknown> extends Omit<
    ApiMutationOptions<TData, TVariables, TContext>,
    'method'
> {
    method?: 'POST' | 'DELETE';
}

export function useBatchMutation<TData, TVariables extends unknown[], TContext = unknown>(
    options: BatchMutationOptions<TData, TVariables, TContext>,
) {
    return useApiMutation<TData, TVariables, TContext>(options);
}
