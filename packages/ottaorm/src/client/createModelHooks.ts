// ============================================================
// @ottabase/ottaorm/client - Model Hooks Factory
// ============================================================
// Type-safe TanStack Query hooks for OttaORM resources
// ============================================================

import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
    type InfiniteData,
    type UseMutationOptions,
    type UseQueryOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import {
    getStableQuerySignal,
    queryRetryDelay,
    shouldAutoRefetchQuery,
    shouldRetryQuery,
    useApiClient,
} from './QueryProvider';
import type {
    ApiClientError,
    ApiClientFunction,
    ModelQueryConfig,
    MutationContext,
    PaginationResult,
    QueryOptions,
} from './types';
import { createQueryKeys, isApiClientError } from './types';

export type ModelQueryHookOptions<TData> = Omit<
    UseQueryOptions<TData, ApiClientError>,
    | 'queryKey'
    | 'queryFn'
    | 'enabled'
    | 'retry'
    | 'retryDelay'
    | 'refetchOnMount'
    | 'refetchOnWindowFocus'
    | 'refetchOnReconnect'
> & {
    enabled?: boolean;
};

export type ModelMutationHookOptions<TData, TVariables, TContext> = Omit<
    UseMutationOptions<TData, ApiClientError, TVariables, TContext>,
    'mutationFn' | 'retry' | 'retryDelay'
>;

export interface ModelClient<T extends { id: string | number }> {
    fetchList(options?: QueryOptions, signal?: AbortSignal): Promise<T[]>;
    fetchDetail(id: string | number, signal?: AbortSignal): Promise<T | null>;
    fetchFind(field: string, value: string | number, signal?: AbortSignal): Promise<T | null>;
    fetchPaginated(
        page: number,
        perPage: number,
        options?: Omit<QueryOptions, 'offset' | 'limit'>,
        signal?: AbortSignal,
    ): Promise<PaginationResult<T>>;
    createItem(data: Partial<T>): Promise<T>;
    updateItem(id: string | number, data: Partial<T>): Promise<T>;
    deleteItem(id: string | number): Promise<boolean>;
}

function normalizeListResponse<T>(result: unknown, entity: string): T[] {
    if (Array.isArray(result)) return result as T[];

    const object = result as Record<string, unknown> | null;
    const byEntity = object?.[entity];
    if (Array.isArray(byEntity)) return byEntity as T[];

    const data = object?.data;
    if (Array.isArray(data)) return data as T[];
    if (typeof data === 'object' && data !== null) {
        const inner = (data as Record<string, unknown>).data;
        if (Array.isArray(inner)) return inner as T[];
    }

    return [];
}

function normalizeItemResponse<T>(result: unknown): T {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const data = (result as Record<string, unknown>).data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return data as T;
        }
    }
    return result as T;
}

function normalizePaginatedResponse<T>(result: unknown, entity: string, depth = 0): PaginationResult<T> {
    if (depth > 2) {
        const list = normalizeListResponse<T>(result, entity);
        return {
            data: list,
            total: list.length,
            page: 1,
            perPage: list.length,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
        };
    }

    if (result && typeof result === 'object' && 'data' in result && 'total' in result && 'page' in result) {
        return result as PaginationResult<T>;
    }

    if (result && typeof result === 'object' && 'data' in result && 'pagination' in result) {
        const object = result as {
            data?: T[];
            pagination?: Partial<Omit<PaginationResult<T>, 'data'>>;
        };
        const items = Array.isArray(object.data) ? object.data : [];
        const pagination = object.pagination ?? {};
        const total = pagination.total ?? items.length;
        const page = pagination.page ?? 1;
        const perPage = pagination.perPage ?? items.length;
        const totalPages =
            pagination.totalPages ?? (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : total > 0 ? 1 : 0);
        return {
            data: items,
            total,
            page,
            perPage,
            totalPages,
            hasNextPage: pagination.hasNextPage ?? page < totalPages,
            hasPrevPage: pagination.hasPrevPage ?? page > 1,
        };
    }

    if (result && typeof result === 'object') {
        const inner = (result as Record<string, unknown>).data;
        if (inner && typeof inner === 'object' && 'data' in inner) {
            return normalizePaginatedResponse<T>(inner, entity, depth + 1);
        }
    }

    const list = normalizeListResponse<T>(result, entity);
    return {
        data: list,
        total: list.length,
        page: 1,
        perPage: list.length,
        totalPages: list.length > 0 ? 1 : 0,
        hasNextPage: false,
        hasPrevPage: false,
    };
}

function appendListOptions(params: URLSearchParams, options?: QueryOptions): void {
    if (options?.where) params.set('where', JSON.stringify(options.where));
    if (options?.orderBy) params.set('orderBy', options.orderBy);
    if (options?.orderDirection) params.set('orderDirection', options.orderDirection);
    if (options?.search) params.set('search', options.search);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
}

/**
 * Create imperative model operations around the mandatory framework client.
 * This is also the single transport implementation used by the React hooks.
 */
export function createModelClient<T extends { id: string | number }>(
    config: ModelQueryConfig,
    apiClient: ApiClientFunction,
): ModelClient<T> {
    const { entityName } = config;
    const apiPath = config.apiPath ?? `/api/ottaorm/${entityName}`;

    return {
        async fetchList(options?: QueryOptions, signal?: AbortSignal): Promise<T[]> {
            const params = new URLSearchParams();
            appendListOptions(params, options);
            const queryString = params.toString();
            const url = queryString ? `${apiPath}?${queryString}` : apiPath;
            const result = await apiClient<unknown>(url, { method: 'GET', signal });
            return normalizeListResponse<T>(result, entityName);
        },

        async fetchDetail(id: string | number, signal?: AbortSignal): Promise<T | null> {
            const url = `${apiPath}/${encodeURIComponent(String(id))}`;
            try {
                const result = await apiClient<unknown>(url, { method: 'GET', signal });
                return result == null ? null : normalizeItemResponse<T>(result);
            } catch (error) {
                if (isApiClientError(error) && error.status === 404) return null;
                throw error;
            }
        },

        async fetchFind(field: string, value: string | number, signal?: AbortSignal): Promise<T | null> {
            const params = new URLSearchParams({
                field,
                value: String(value),
            });
            try {
                const result = await apiClient<unknown>(`${apiPath}?${params.toString()}`, {
                    method: 'GET',
                    signal,
                });
                return result == null ? null : normalizeItemResponse<T>(result);
            } catch (error) {
                if (isApiClientError(error) && error.status === 404) return null;
                throw error;
            }
        },

        async fetchPaginated(
            page: number,
            perPage: number,
            options?: Omit<QueryOptions, 'offset' | 'limit'>,
            signal?: AbortSignal,
        ): Promise<PaginationResult<T>> {
            const params = new URLSearchParams({
                page: String(page),
                perPage: String(perPage),
            });
            appendListOptions(params, options);
            const result = await apiClient<unknown>(`${apiPath}?${params.toString()}`, {
                method: 'GET',
                signal,
            });
            return normalizePaginatedResponse<T>(result, entityName);
        },

        async createItem(data: Partial<T>): Promise<T> {
            const result = await apiClient<unknown>(apiPath, {
                method: 'POST',
                body: data,
            });
            return normalizeItemResponse<T>(result);
        },

        async updateItem(id: string | number, data: Partial<T>): Promise<T> {
            const result = await apiClient<unknown>(`${apiPath}/${encodeURIComponent(String(id))}`, {
                method: 'PATCH',
                body: data,
            });
            return normalizeItemResponse<T>(result);
        },

        async deleteItem(id: string | number): Promise<boolean> {
            await apiClient(`${apiPath}/${encodeURIComponent(String(id))}`, {
                method: 'DELETE',
            });
            return true;
        },
    };
}

/**
 * Create a complete set of query hooks for an OttaORM model.
 */
export function createModelHooks<T extends { id: string | number }>(config: ModelQueryConfig) {
    const { entityName } = config;
    const queryKeys = createQueryKeys(entityName);

    function useModelClient(): ModelClient<T> {
        const apiClient = useApiClient();
        return useMemo(() => createModelClient<T>(config, apiClient), [apiClient]);
    }

    function useList(options?: QueryOptions, queryOptions?: ModelQueryHookOptions<T[]>) {
        const client = useModelClient();
        return useQuery<T[], ApiClientError>({
            ...queryOptions,
            queryKey: queryKeys.list(options),
            queryFn: async (context) => client.fetchList(options, await getStableQuerySignal(context)),
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            refetchOnMount: shouldAutoRefetchQuery,
            refetchOnWindowFocus: shouldAutoRefetchQuery,
            refetchOnReconnect: shouldAutoRefetchQuery,
        });
    }

    function useDetail(id: string | number, queryOptions?: ModelQueryHookOptions<T | null>) {
        const client = useModelClient();
        const hasId = id !== undefined && id !== null && id !== '';
        return useQuery<T | null, ApiClientError>({
            ...queryOptions,
            queryKey: queryKeys.detail(id),
            queryFn: async (context) => client.fetchDetail(id, await getStableQuerySignal(context)),
            enabled: hasId && queryOptions?.enabled !== false,
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            refetchOnMount: shouldAutoRefetchQuery,
            refetchOnWindowFocus: shouldAutoRefetchQuery,
            refetchOnReconnect: shouldAutoRefetchQuery,
        });
    }

    function useFind(field: string, value: string | number, queryOptions?: ModelQueryHookOptions<T | null>) {
        const client = useModelClient();
        const canFind = field.length > 0 && value !== undefined && value !== null && value !== '';
        return useQuery<T | null, ApiClientError>({
            ...queryOptions,
            queryKey: queryKeys.find(field, value),
            queryFn: async (context) => client.fetchFind(field, value, await getStableQuerySignal(context)),
            enabled: canFind && queryOptions?.enabled !== false,
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            refetchOnMount: shouldAutoRefetchQuery,
            refetchOnWindowFocus: shouldAutoRefetchQuery,
            refetchOnReconnect: shouldAutoRefetchQuery,
        });
    }

    function useInfiniteList(options?: Omit<QueryOptions, 'offset' | 'limit'>, perPage = 10) {
        const client = useModelClient();
        return useInfiniteQuery<
            PaginationResult<T>,
            ApiClientError,
            InfiniteData<PaginationResult<T>>,
            ReturnType<typeof queryKeys.infinite>,
            number
        >({
            queryKey: queryKeys.infinite(options, perPage),
            queryFn: async (context) =>
                client.fetchPaginated(context.pageParam, perPage, options, await getStableQuerySignal(context)),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.page + 1 : undefined),
            getPreviousPageParam: (firstPage) => (firstPage.hasPrevPage ? firstPage.page - 1 : undefined),
        });
    }

    function invalidateCollections(queryClient: ReturnType<typeof useQueryClient>): void {
        void queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.infinites() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.finds() });
    }

    function useCreate(mutationOptions?: ModelMutationHookOptions<T, Partial<T>, MutationContext<T>>) {
        const client = useModelClient();
        const queryClient = useQueryClient();
        const { onSuccess: consumerOnSuccess, meta: consumerMeta, ...consumerOptions } = mutationOptions ?? {};

        return useMutation<T, ApiClientError, Partial<T>, MutationContext<T>>({
            ...consumerOptions,
            meta: { ...consumerMeta, entity: entityName },
            mutationFn: client.createItem,
            retry: false,
            onSuccess: async (record, variables, onMutateResult, mutationContext) => {
                queryClient.setQueryData(queryKeys.detail(record.id), record);
                invalidateCollections(queryClient);
                await consumerOnSuccess?.(record, variables, onMutateResult, mutationContext);
            },
        });
    }

    function useUpdate(
        mutationOptions?: ModelMutationHookOptions<T, { id: string | number; data: Partial<T> }, MutationContext<T>>,
    ) {
        const client = useModelClient();
        const queryClient = useQueryClient();
        const {
            onMutate: consumerOnMutate,
            onError: consumerOnError,
            onSuccess: consumerOnSuccess,
            meta: consumerMeta,
            ...consumerOptions
        } = mutationOptions ?? {};

        return useMutation<T, ApiClientError, { id: string | number; data: Partial<T> }, MutationContext<T>>({
            ...consumerOptions,
            meta: {
                ...consumerMeta,
                entity: entityName,
                errorPresentation: consumerMeta?.errorPresentation ?? (consumerOnError ? 'local' : 'global'),
            },
            mutationFn: ({ id, data }) => client.updateItem(id, data),
            retry: false,
            onMutate: async (variables, mutationContext) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.detail(variables.id) });
                const previousItem = queryClient.getQueryData<T>(queryKeys.detail(variables.id)) ?? undefined;
                if (previousItem) {
                    queryClient.setQueryData<T>(queryKeys.detail(variables.id), {
                        ...previousItem,
                        ...variables.data,
                    } as T);
                }

                const context: MutationContext<T> = { previousItem };
                const consumerContext = await consumerOnMutate?.(variables, mutationContext);
                if (consumerContext) Object.assign(context, consumerContext);
                return context;
            },
            onError: async (error, variables, context, mutationContext) => {
                if (context?.previousItem) {
                    queryClient.setQueryData(queryKeys.detail(variables.id), context.previousItem);
                }
                await consumerOnError?.(error, variables, context, mutationContext);
            },
            onSuccess: async (record, variables, context, mutationContext) => {
                queryClient.setQueryData(queryKeys.detail(variables.id), record);
                invalidateCollections(queryClient);
                await consumerOnSuccess?.(record, variables, context, mutationContext);
            },
        });
    }

    function useDelete(mutationOptions?: ModelMutationHookOptions<boolean, string | number, MutationContext<T>>) {
        const client = useModelClient();
        const queryClient = useQueryClient();
        const {
            onMutate: consumerOnMutate,
            onError: consumerOnError,
            onSuccess: consumerOnSuccess,
            meta: consumerMeta,
            ...consumerOptions
        } = mutationOptions ?? {};

        return useMutation<boolean, ApiClientError, string | number, MutationContext<T>>({
            ...consumerOptions,
            meta: {
                ...consumerMeta,
                entity: entityName,
                errorPresentation: consumerMeta?.errorPresentation ?? (consumerOnError ? 'local' : 'global'),
            },
            mutationFn: client.deleteItem,
            retry: false,
            onMutate: async (id, mutationContext) => {
                await queryClient.cancelQueries({ queryKey: queryKeys.detail(id) });
                const previousItem = queryClient.getQueryData<T>(queryKeys.detail(id)) ?? undefined;
                queryClient.removeQueries({ queryKey: queryKeys.detail(id) });

                const context: MutationContext<T> = { previousItem };
                const consumerContext = await consumerOnMutate?.(id, mutationContext);
                if (consumerContext) Object.assign(context, consumerContext);
                return context;
            },
            onError: async (error, id, context, mutationContext) => {
                if (context?.previousItem) {
                    queryClient.setQueryData(queryKeys.detail(id), context.previousItem);
                }
                await consumerOnError?.(error, id, context, mutationContext);
            },
            onSuccess: async (result, id, context, mutationContext) => {
                queryClient.removeQueries({ queryKey: queryKeys.detail(id) });
                invalidateCollections(queryClient);
                await consumerOnSuccess?.(result, id, context, mutationContext);
            },
        });
    }

    function usePrefetch() {
        const queryClient = useQueryClient();
        const client = useModelClient();

        return {
            prefetchList: async (options?: QueryOptions) => {
                await queryClient.prefetchQuery({
                    queryKey: queryKeys.list(options),
                    queryFn: async (context) => client.fetchList(options, await getStableQuerySignal(context)),
                });
            },
            prefetchDetail: async (id: string | number) => {
                await queryClient.prefetchQuery({
                    queryKey: queryKeys.detail(id),
                    queryFn: async (context) => client.fetchDetail(id, await getStableQuerySignal(context)),
                });
            },
            prefetchFind: async (field: string, value: string | number) => {
                await queryClient.prefetchQuery({
                    queryKey: queryKeys.find(field, value),
                    queryFn: async (context) => client.fetchFind(field, value, await getStableQuerySignal(context)),
                });
            },
        };
    }

    function useInvalidate() {
        const queryClient = useQueryClient();
        return {
            invalidateAll: () => queryClient.invalidateQueries({ queryKey: queryKeys.all() }),
            invalidateList: (options?: QueryOptions) =>
                queryClient.invalidateQueries({ queryKey: queryKeys.list(options) }),
            invalidateDetail: (id: string | number) =>
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) }),
        };
    }

    return {
        useList,
        useDetail,
        useFind,
        useInfiniteList,
        useCreate,
        useUpdate,
        useDelete,
        usePrefetch,
        useInvalidate,
        queryKeys,
    };
}
