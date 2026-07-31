// ============================================================
// @ottabase/ottaorm/client - Type Definitions
// ============================================================
// Client-only types - no server dependencies
// ============================================================

/**
 * The request options OttaORM needs from @ottabase/api. This deliberately
 * remains structural so the edge-safe ORM package does not pull the transport
 * implementation into its server entry points.
 */
export interface ApiClientRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined | null>;
    headers?: Record<string, string>;
    skipAuth?: boolean;
    timeout?: number;
}

export type ApiClientHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Structurally compatible with @ottabase/api's ApiFunction.
 */
export interface ApiClientFunction {
    <T = unknown>(endpoint: string, options?: ApiClientRequestOptions): Promise<T>;
    <T = unknown>(endpoint: string, method: ApiClientHttpMethod): Promise<T>;
}

/**
 * Structured error contract implemented by @ottabase/api's ApiError.
 */
export interface ApiClientError extends Error {
    readonly name: 'ApiError';
    readonly status: number;
    readonly code?: string;
    readonly details?: string;
    readonly hint?: string;
    readonly messages: string[];
    readonly fieldErrors?: Record<string, string[]>;
    readonly metadata?: Record<string, unknown>;
    readonly requestId?: string;
    readonly response?: Response;
    readonly retryable: boolean;
    readonly retryAfterMs?: number;
}

export function isApiClientError(error: unknown): error is ApiClientError {
    return (
        error instanceof Error &&
        error.name === 'ApiError' &&
        'status' in error &&
        typeof (error as { status?: unknown }).status === 'number'
    );
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
    search?: string;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
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
}

/**
 * Query key factory for consistent key generation
 */
export type QueryKeyFactory<T extends string> = {
    all: () => readonly [T];
    lists: () => readonly [T, 'list'];
    list: (filters?: QueryOptions) => readonly [T, 'list', QueryOptions | undefined];
    details: () => readonly [T, 'detail'];
    detail: (id: string | number) => readonly [T, 'detail', string | number];
    finds: () => readonly [T, 'find'];
    find: (field: string, value: string | number) => readonly [T, 'find', string, string | number];
    infinites: () => readonly [T, 'infinite'];
    infinite: (
        filters: Omit<QueryOptions, 'offset' | 'limit'> | undefined,
        perPage: number,
    ) => readonly [T, 'infinite', { filters: Omit<QueryOptions, 'offset' | 'limit'> | undefined; perPage: number }];
};

/**
 * Create query keys for an entity
 */
export function createQueryKeys<T extends string>(entity: T): QueryKeyFactory<T> {
    return {
        all: () => [entity] as const,
        lists: () => [entity, 'list'] as const,
        list: (filters?: QueryOptions) => [entity, 'list', filters] as const,
        details: () => [entity, 'detail'] as const,
        detail: (id: string | number) => [entity, 'detail', id] as const,
        finds: () => [entity, 'find'] as const,
        find: (field: string, value: string | number) => [entity, 'find', field, value] as const,
        infinites: () => [entity, 'infinite'] as const,
        infinite: (filters, perPage) => [entity, 'infinite', { filters, perPage }] as const,
    };
}

/**
 * Mutation context for optimistic updates
 */
export interface MutationContext<T> {
    previousData?: T[];
    previousItem?: T;
}
