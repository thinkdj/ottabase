// ============================================================
// @ottabase/ottaorm/client - Entity Query Hook
// ============================================================

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import {
    getStableQuerySignal,
    queryRetryDelay,
    shouldAutoRefetchQuery,
    shouldRetryQuery,
    useApiClient,
} from './QueryProvider';
import type { ApiClientError, ApiClientFunction, ApiClientHttpMethod, ApiClientRequestOptions } from './types';

type EntityQueryOptions<TData> = Omit<
    UseQueryOptions<TData, ApiClientError>,
    'queryKey' | 'queryFn' | 'retry' | 'retryDelay' | 'refetchOnMount' | 'refetchOnWindowFocus' | 'refetchOnReconnect'
>;
type NonEmptyQueryKey = readonly [unknown, ...unknown[]];

export interface UseEntityQueryOptions<TData> extends EntityQueryOptions<TData> {
    /**
     * Required operation identity within the entity namespace. Requiring at
     * least one segment prevents unrelated endpoints from collapsing to the
     * same `[entityName]` cache key.
     */
    subKey: NonEmptyQueryKey;
}

function bindSignal(apiClient: ApiClientFunction, signal: AbortSignal): ApiClientFunction {
    return (async <T>(
        endpoint: string,
        optionsOrMethod: ApiClientRequestOptions | ApiClientHttpMethod = {},
    ): Promise<T> => {
        const options = typeof optionsOrMethod === 'string' ? { method: optionsOrMethod } : optionsOrMethod;
        return apiClient<T>(endpoint, {
            ...options,
            signal,
        });
    }) as ApiClientFunction;
}

/**
 * Fetch entity-related data from a custom endpoint while retaining entity
 * invalidation semantics. The provided client is automatically bound to the
 * TanStack query AbortSignal.
 */
export function useEntityQuery<TData>(
    entityName: string,
    queryFn: (api: ApiClientFunction) => Promise<TData>,
    options: UseEntityQueryOptions<TData>,
) {
    const { subKey, ...queryOptions } = options;
    const apiClient = useApiClient();

    return useQuery<TData, ApiClientError>({
        ...queryOptions,
        queryKey: [entityName, ...subKey],
        queryFn: async (context) => queryFn(bindSignal(apiClient, await getStableQuerySignal(context))),
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        refetchOnMount: shouldAutoRefetchQuery,
        refetchOnWindowFocus: shouldAutoRefetchQuery,
        refetchOnReconnect: shouldAutoRefetchQuery,
    });
}
