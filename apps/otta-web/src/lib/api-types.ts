/**
 * Shared API Types for the Vite Template App
 *
 * These types mirror the server-side pagination format from @ottabase/utils/pagination
 * for type-safe API consumption on the frontend.
 */

// ============================================================
// Pagination Types
// ============================================================

/**
 * Pagination info object
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
 */
export interface PaginatedResponse<T> {
    /** Array of items for the current page */
    data: T[];
    /** Pagination metadata */
    pagination: Pagination;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Check if a response is a valid paginated response
 */
export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
    if (!response || typeof response !== 'object') return false;
    const r = response as Record<string, unknown>;
    return Array.isArray(r.data) && typeof r.pagination === 'object' && r.pagination !== null;
}

/**
 * Get pagination info from a paginated response
 */
export function getPaginationInfo(pagination: Pagination) {
    return {
        currentPage: pagination.page,
        perPage: pagination.perPage,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNextPage: pagination.page < pagination.totalPages,
        hasPrevPage: pagination.page > 1,
    };
}
