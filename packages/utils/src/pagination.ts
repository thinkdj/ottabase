/**
 * Standardized Pagination Response Types and Helpers
 *
 * Implements a simplified pagination format for consistent API responses
 * across all OttaBase collection/list endpoints.
 */

// ============================================================
// Types
// ============================================================

/**
 * Pagination info object with all pagination metadata
 */
export interface Pagination {
    /** Current page number (1-indexed) */
    page: number;
    /** Number of items per page */
    perPage: number;
    /** Total number of items across all pages */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** URL to next page (null if on last page) */
    next: string | null;
    /** URL to previous page (null if on first page) */
    prev: string | null;
}

/**
 * Paginated API response
 *
 * @example
 * ```typescript
 * const response: PaginatedResponse<User> = {
 *   data: [{ id: 1, name: "John" }],
 *   pagination: {
 *     page: 1,
 *     perPage: 15,
 *     total: 75,
 *     totalPages: 5,
 *     next: "/api/users?page=2&per_page=15",
 *     prev: null
 *   }
 * };
 * ```
 */
export interface PaginatedResponse<T> {
    /** Array of items for the current page */
    data: T[];
    /** Pagination metadata */
    pagination: Pagination;
}

/**
 * Simple pagination result (internal use by OttaORM)
 */
export interface SimplePaginationResult<T> {
    data: T[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

// ============================================================
// Parameters
// ============================================================

/**
 * Default pagination values
 */
export const PAGINATION_DEFAULTS = {
    page: 1,
    perPage: 15,
    maxPerPage: 100,
    order: 'desc' as const,
    orderBy: 'createdAt',
} as const;

/**
 * Raw parameters for pagination queries (optional fields)
 */
export interface PaginationParams {
    /** Page number (1-indexed), defaults to 1 */
    page?: number;
    /** Items per page, defaults to 15 */
    perPage?: number;
    /** Field to sort by */
    orderBy?: string;
    /** Sort direction */
    order?: 'asc' | 'desc';
    /** General search term */
    search?: string;
    /** Additional filter conditions */
    filter?: Record<string, unknown>;
}

/**
 * Parsed pagination parameters with guaranteed values
 * All fields have defaults applied, safe for direct destructuring
 */
export interface ParsedPaginationParams {
    /** Page number (1-indexed), guaranteed >= 1 */
    page: number;
    /** Items per page, guaranteed 1-100 */
    perPage: number;
    /** Field to sort by */
    orderBy: string;
    /** Sort direction */
    order: 'asc' | 'desc';
    /** General search term (empty string if not provided) */
    search: string;
}

export interface ParsePaginationOptions {
    /** Default values to use (merged with PAGINATION_DEFAULTS) */
    defaults?: Partial<ParsedPaginationParams>;
}

/**
 * Parse pagination parameters from URL or request object
 * Returns an object with guaranteed values (defaults applied)
 *
 * @example
 * ```typescript
 * // From URLSearchParams
 * const { page, perPage, orderBy, order } = parsePaginationParams(url.searchParams);
 *
 * // With custom defaults
 * const params = parsePaginationParams(url.searchParams, {
 *   defaults: { perPage: 25, orderBy: "name" }
 * });
 * ```
 */
export function parsePaginationParams(
    source: URLSearchParams | Record<string, string | number | undefined | null>,
    options?: ParsePaginationOptions,
): ParsedPaginationParams {
    const defaults: ParsedPaginationParams = {
        page: options?.defaults?.page ?? PAGINATION_DEFAULTS.page,
        perPage: options?.defaults?.perPage ?? PAGINATION_DEFAULTS.perPage,
        orderBy: options?.defaults?.orderBy ?? PAGINATION_DEFAULTS.orderBy,
        order: options?.defaults?.order ?? PAGINATION_DEFAULTS.order,
        search: options?.defaults?.search ?? '',
    };

    // Handle URLSearchParams
    if (source instanceof URLSearchParams) {
        const pageStr = source.get('page');
        const perPageStr = source.get('per_page') || source.get('perPage');
        const orderByStr = source.get('sort') || source.get('orderBy') || source.get('order_by');
        const orderStr = source.get('order') || source.get('direction');
        const searchStr = source.get('search') || source.get('q');

        const page = pageStr ? parseInt(pageStr, 10) : defaults.page;
        const perPage = perPageStr ? parseInt(perPageStr, 10) : defaults.perPage;

        return {
            page: isNaN(page) || page < 1 ? defaults.page : page,
            perPage:
                isNaN(perPage) || perPage < 1 ? defaults.perPage : Math.min(perPage, PAGINATION_DEFAULTS.maxPerPage),
            orderBy: orderByStr || defaults.orderBy,
            order: orderStr === 'asc' || orderStr === 'desc' ? orderStr : defaults.order,
            search: searchStr || defaults.search,
        };
    }

    // Handle plain object
    const page =
        typeof source.page === 'number' ? source.page : source.page ? parseInt(String(source.page), 10) : defaults.page;

    const perPageValue = source.perPage ?? source.per_page;
    const perPage =
        typeof perPageValue === 'number'
            ? perPageValue
            : perPageValue
              ? parseInt(String(perPageValue), 10)
              : defaults.perPage;

    const orderByValue = source.orderBy ?? source.order_by ?? source.sort;
    const orderValue = source.order ?? source.direction;

    return {
        page: isNaN(page) || page < 1 ? defaults.page : page,
        perPage: isNaN(perPage) || perPage < 1 ? defaults.perPage : Math.min(perPage, PAGINATION_DEFAULTS.maxPerPage),
        orderBy: (orderByValue as string) || defaults.orderBy,
        order: orderValue === 'asc' || orderValue === 'desc' ? orderValue : defaults.order,
        search: (source.search as string) || (source.q as string) || defaults.search,
    };
}

// ============================================================
// Response Builders
// ============================================================

export interface CreatePaginatedResponseOptions<T> {
    /** Array of items for the current page */
    data: T[];
    /** Total number of items across all pages */
    total: number;
    /** Current page number (1-indexed) */
    page: number;
    /** Number of items per page */
    perPage: number;
    /** Base path for generating URLs (e.g., "/api/users") */
    path: string;
}

/**
 * Create a paginated response
 *
 * @example
 * ```typescript
 * const shortlinks = await Shortlink.all();
 * const response = createPaginatedResponse({
 *   data: shortlinks.map(s => s.toJson()),
 *   total: 100,
 *   page: 1,
 *   perPage: 15,
 *   path: '/api/shortlinks'
 * });
 * return jsonResponse(response);
 * ```
 */
export function createPaginatedResponse<T>(options: CreatePaginatedResponseOptions<T>): PaginatedResponse<T> {
    const { data, total, page, perPage, path } = options;

    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    return {
        data,
        pagination: {
            page: currentPage,
            perPage,
            total,
            totalPages,
            next: currentPage < totalPages ? `${path}?page=${currentPage + 1}&per_page=${perPage}` : null,
            prev: currentPage > 1 ? `${path}?page=${currentPage - 1}&per_page=${perPage}` : null,
        },
    };
}

/**
 * Convert SimplePaginationResult to PaginatedResponse
 * Useful when working with OttaORM's paginate() method
 */
export function toPaginatedResponse<T>(result: SimplePaginationResult<T>, path: string): PaginatedResponse<T> {
    return createPaginatedResponse({
        data: result.data,
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        path,
    });
}

// ============================================================
// HTTP Response Helper
// ============================================================

/**
 * Create an HTTP Response with paginated JSON data
 *
 * @example
 * ```typescript
 * // In Cloudflare Worker or API route:
 * const shortlinks = await Shortlink.all();
 * return paginatedJsonResponse({
 *   data: shortlinks.map(s => s.toJson()),
 *   total: 100,
 *   page: 1,
 *   perPage: 15,
 *   path: '/api/shortlinks'
 * });
 * ```
 */
export function paginatedJsonResponse<T>(
    options: CreatePaginatedResponseOptions<T>,
    status: number = 200,
    init: ResponseInit = {},
): Response {
    const paginatedData = createPaginatedResponse(options);
    return new Response(JSON.stringify(paginatedData), {
        ...init,
        status,
        headers: {
            ...init.headers,
            'Content-Type': 'application/json',
        },
    });
}
