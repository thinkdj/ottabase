// ============================================================
// @ottabase/ottaorm/client - Client-side TanStack Query Integration
// ============================================================
// Type-safe data fetching for OttaORM models with automatic caching
// ============================================================

// Types
export type {
    ApiClientError,
    ApiClientFunction,
    ApiClientHttpMethod,
    ApiClientRequestOptions,
    PaginationResult,
    QueryOptions,
    ModelQueryConfig,
    QueryKeyFactory,
    MutationContext,
} from './types';
export { createQueryKeys, isApiClientError } from './types';

// Model hooks factory
export {
    createModelClient,
    createModelHooks,
    type ModelClient,
    type ModelMutationHookOptions,
    type ModelQueryHookOptions,
} from './createModelHooks';

// Generic API hooks for custom endpoints
export {
    useApiQuery,
    useApiMutation,
    useBatchMutation,
    type ApiMutationOptions,
    type ApiQueryOptions,
    type BatchMutationOptions,
} from './useApiQuery';

// Entity-namespaced query hook (framework standard for custom-endpoint queries)
export { useEntityQuery, type UseEntityQueryOptions } from './useEntityQuery';

// Provider
export {
    OttaQueryProvider,
    createQueryClient,
    createVisibilityScopeKey,
    defaultQueryConfig,
    getStableQuerySignal,
    isRetryableQueryError,
    queryRetryDelay,
    shouldAutoRefetchQuery,
    shouldRetryQuery,
    useApiClient,
    type OttaQueryClientConfig,
    type OttaQueryErrorContext,
    type OttaQueryErrorReporter,
    type OttaQueryProviderProps,
    type VisibilityScope,
} from './QueryProvider';

// Re-export commonly used TanStack Query exports for convenience
export {
    useQuery,
    useMutation,
    useInfiniteQuery,
    useQueryClient,
    useIsFetching,
    useIsMutating,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
