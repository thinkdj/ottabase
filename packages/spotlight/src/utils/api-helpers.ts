/**
 * Helper utilities for using @ottabase/api with Spotlight
 */

import type { SpotlightResult } from '../types';

/**
 * Type definition matching @ottabase/api's ApiFunction
 * This allows the helpers to work with @ottabase/api without requiring it as a dependency
 */
export type ApiFunction = {
    <T = unknown>(
        endpoint: string,
        options?: {
            method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
            params?: Record<string, string | number | boolean | undefined | null>;
            body?: unknown;
            headers?: Record<string, string>;
            skipAuth?: boolean;
            timeout?: number;
        },
    ): Promise<T>;
    <T = unknown>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): Promise<T>;
};

/**
 * Creates a search handler that uses @ottabase/api client
 *
 * @example
 * ```tsx
 * import { createApiSearchHandler } from "@ottabase/spotlight/utils/api-helpers";
 * import { api } from "@ottabase/api";
 *
 * const handleSearch = createApiSearchHandler({
 *   api,
 *   endpoint: "/api/search",
 *   transform: (item) => ({
 *     id: item.id,
 *     label: item.title,
 *     description: item.description,
 *     onSelect: () => navigate(`/items/${item.id}`),
 *   }),
 * });
 * ```
 */
export interface CreateApiSearchHandlerOptions<T = unknown> {
    /** The API client function from @ottabase/api */
    api: ApiFunction;
    /** API endpoint to search */
    endpoint: string;
    /** Transform API response items to SpotlightResult */
    transform: (item: T) => SpotlightResult;
    /** Additional query parameters */
    params?: Record<string, string | number | boolean | undefined | null>;
    /** Query parameter name (default: "q") */
    queryParamName?: string;
}

export function createApiSearchHandler<T = unknown>({
    api,
    endpoint,
    transform,
    params = {},
    queryParamName = 'q',
}: CreateApiSearchHandlerOptions<T>) {
    return async (query: string, signal?: AbortSignal): Promise<SpotlightResult[]> => {
        try {
            const results = await api<Array<T>>(endpoint, {
                params: {
                    [queryParamName]: query,
                    ...params,
                },
                // Note: @ottabase/api uses fetch internally which respects AbortSignal
                // However, the current API client doesn't expose signal directly.
                // For full abort support, use fetch directly or extend the API client.
            });

            return results.map(transform);
        } catch (error) {
            // Re-throw to let Spotlight handle the error
            throw error;
        }
    };
}

/**
 * Helper to create a search handler with abort signal support using fetch
 * This provides full abort signal support when using @ottabase/api
 */
export function createApiSearchHandlerWithSignal<T = unknown>({
    endpoint,
    transform,
    params = {},
    queryParamName = 'q',
    getAuthToken,
    baseUrl = '',
}: {
    endpoint: string;
    transform: (item: T) => SpotlightResult;
    params?: Record<string, string | number | boolean | undefined | null>;
    queryParamName?: string;
    getAuthToken?: () => string | null | Promise<string | null>;
    baseUrl?: string;
}) {
    return async (query: string, signal?: AbortSignal): Promise<SpotlightResult[]> => {
        // Build URL
        const url = new URL(endpoint, baseUrl || window.location.origin);
        url.searchParams.set(queryParamName, query);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });

        // Build headers
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        // Add auth token if available
        if (getAuthToken) {
            const token = await getAuthToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // Make request with abort signal
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers,
            signal, // Full abort signal support
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }

        const results = await response.json();
        return Array.isArray(results) ? results.map(transform) : [];
    };
}
