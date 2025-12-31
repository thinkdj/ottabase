// ============================================================
// @ottabase/query - Type Definitions
// ============================================================

import type {
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions,
  QueryKey,
} from "@tanstack/react-query";

/**
 * Pagination result from OttaORM
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Query options for filtering and ordering
 */
export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Configuration for creating model query hooks
 */
export interface ModelQueryConfig<T> {
  /** Base entity name (used for query keys) */
  entityName: string;
  /** Base API path (e.g., "/api/users") */
  apiPath: string;
  /** Custom fetch function (optional - defaults to browser fetch) */
  fetchFn?: typeof fetch;
  /** Default query options */
  defaultQueryOptions?: Partial<UseQueryOptions<T[], Error>>;
  /** Default mutation options */
  defaultMutationOptions?: Partial<UseMutationOptions<T, Error, Partial<T>>>;
}

/**
 * Query key factory for consistent key generation
 */
export type QueryKeyFactory<T extends string> = {
  all: () => readonly [T];
  lists: () => readonly [T, "list"];
  list: (filters?: QueryOptions) => readonly [T, "list", QueryOptions | undefined];
  details: () => readonly [T, "detail"];
  detail: (id: string | number) => readonly [T, "detail", string | number];
  infinite: (filters?: QueryOptions) => readonly [T, "infinite", QueryOptions | undefined];
};

/**
 * Create query keys for an entity
 */
export function createQueryKeys<T extends string>(entity: T): QueryKeyFactory<T> {
  return {
    all: () => [entity] as const,
    lists: () => [entity, "list"] as const,
    list: (filters?: QueryOptions) => [entity, "list", filters] as const,
    details: () => [entity, "detail"] as const,
    detail: (id: string | number) => [entity, "detail", id] as const,
    infinite: (filters?: QueryOptions) => [entity, "infinite", filters] as const,
  };
}

/**
 * CRUD operation types
 */
export type CrudOperation = "create" | "update" | "delete";

/**
 * Mutation context for optimistic updates
 */
export interface MutationContext<T> {
  previousData?: T[];
  previousItem?: T;
}

/**
 * Options for optimistic update configuration
 */
export interface OptimisticConfig<T> {
  /** Enable optimistic updates */
  enabled?: boolean;
  /** Custom rollback handler */
  onRollback?: (context: MutationContext<T>, error: Error) => void;
  /** Custom success handler */
  onOptimisticSuccess?: (newItem: T) => void;
}

/**
 * Hook return type for model queries
 */
export interface UseModelQueryReturn<T> {
  // Query hooks
  useList: (
    options?: QueryOptions,
    queryOptions?: Partial<UseQueryOptions<T[], Error>>
  ) => ReturnType<typeof import("@tanstack/react-query").useQuery<T[], Error>>;

  useDetail: (
    id: string | number,
    queryOptions?: Partial<UseQueryOptions<T | null, Error>>
  ) => ReturnType<typeof import("@tanstack/react-query").useQuery<T | null, Error>>;

  useInfiniteList: (
    options?: Omit<QueryOptions, "offset" | "limit">,
    perPage?: number,
    queryOptions?: Partial<UseInfiniteQueryOptions<PaginationResult<T>, Error>>
  ) => ReturnType<typeof import("@tanstack/react-query").useInfiniteQuery<PaginationResult<T>, Error>>;

  // Mutation hooks
  useCreate: (
    mutationOptions?: Partial<UseMutationOptions<T, Error, Partial<T>>>
  ) => ReturnType<typeof import("@tanstack/react-query").useMutation<T, Error, Partial<T>>>;

  useUpdate: (
    mutationOptions?: Partial<UseMutationOptions<T, Error, { id: string | number; data: Partial<T> }>>
  ) => ReturnType<typeof import("@tanstack/react-query").useMutation<T, Error, { id: string | number; data: Partial<T> }>>;

  useDelete: (
    mutationOptions?: Partial<UseMutationOptions<boolean, Error, string | number>>
  ) => ReturnType<typeof import("@tanstack/react-query").useMutation<boolean, Error, string | number>>;

  // Query keys for manual cache manipulation
  queryKeys: QueryKeyFactory<string>;

  // Prefetch helpers
  prefetchList: (options?: QueryOptions) => Promise<void>;
  prefetchDetail: (id: string | number) => Promise<void>;

  // Cache invalidation helpers
  invalidateAll: () => Promise<void>;
  invalidateList: (options?: QueryOptions) => Promise<void>;
  invalidateDetail: (id: string | number) => Promise<void>;
}
