// ============================================================
// @ottabase/ottaorm/client - Type Definitions
// ============================================================
// Client-only types - no server dependencies
// ============================================================

/**
 * API client function signature for dependency injection.
 * Compatible with @ottabase/api's ApiFunction interface.
 */
export interface ApiClientFunction {
  <T = unknown>(endpoint: string, options?: {
    method?: string;
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined | null>;
    headers?: Record<string, string>;
    [key: string]: unknown;
  }): Promise<T>;
}

/**
 * Pagination result structure (matches OttaORM.paginate output)
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
 * Configuration for creating model query hooks
 */
export interface ModelQueryConfig {
  /** Entity name (used for query keys and API path, e.g., "users") */
  entityName: string;
  /** Base API path (defaults to "/api/ottaorm/{entityName}") */
  apiPath?: string;
  /** Custom fetch function (optional - defaults to browser fetch) */
  fetchFn?: typeof fetch;
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
 * Mutation context for optimistic updates
 */
export interface MutationContext<T> {
  previousData?: T[];
  previousItem?: T;
}
