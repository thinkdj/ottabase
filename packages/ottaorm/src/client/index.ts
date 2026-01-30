// ============================================================
// @ottabase/ottaorm/client - Client-side TanStack Query Integration
// ============================================================
// Type-safe data fetching for OttaORM models with automatic caching
// ============================================================

// Types
export type { PaginationResult, QueryOptions, ModelQueryConfig, QueryKeyFactory, MutationContext } from './types';
export { createQueryKeys } from './types';

// Model hooks factory
export { createModelHooks } from './createModelHooks';

// Generic API hooks for custom endpoints
export { useApiQuery, useApiMutation, useBatchMutation } from './useApiQuery';

// Provider
export { OttaQueryProvider, createQueryClient, defaultQueryConfig, type OttaQueryProviderProps } from './QueryProvider';

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
