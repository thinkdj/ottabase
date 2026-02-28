/**
 * React Query Configuration
 *
 * Centralized staleTime and gcTime configurations for different query types.
 * This prevents unnecessary refetches while keeping data reasonably fresh.
 */

/**
 * Blog List Query Configuration
 * - Stale time: 2 minutes (blog lists don't change frequently)
 * - GC time: 5 minutes (keep in cache for quick navigation back)
 */
export const BLOG_LIST_QUERY_CONFIG = {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
};

/**
 * Blog Detail Query Configuration
 * - Stale time: 5 minutes (individual posts rarely change)
 * - GC time: 10 minutes (keep in cache longer for re-visits)
 */
export const BLOG_DETAIL_QUERY_CONFIG = {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
};

/**
 * Series List Query Configuration
 * - Stale time: 5 minutes (series metadata changes infrequently)
 * - GC time: 10 minutes
 */
export const SERIES_LIST_QUERY_CONFIG = {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
};

/**
 * Version History Query Configuration
 * - Stale time: 30 seconds (versions can be created frequently during editing)
 * - GC time: 2 minutes
 */
export const VERSION_HISTORY_QUERY_CONFIG = {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
};

/**
 * Admin List Query Configuration
 * - Stale time: 1 minute (admin lists may update frequently)
 * - GC time: 3 minutes
 */
export const ADMIN_LIST_QUERY_CONFIG = {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
};
