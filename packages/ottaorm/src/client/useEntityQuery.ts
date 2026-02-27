// ============================================================
// @ottabase/ottaorm/client - Entity Query Hook
// ============================================================
// Framework-standard hook for entity-namespaced queries.
// Any query declared with an entityName automatically falls
// under that entity's query key namespace, so all mutations
// from createModelHooks (and useApiMutation with entity) will
// invalidate it via prefix matching — no manual key alignment.
// ============================================================

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useApiClient } from './QueryProvider';
import type { ApiClientFunction } from './types';

type EntityQueryOptions<TData, TError = Error> = Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>;

// Minimal fetch adapter matching ApiClientFunction, used when no injected client is available.
const fetchAdapter: ApiClientFunction = async (endpoint, options) => {
    const response = await fetch(endpoint, {
        method: options?.method ?? 'GET',
        headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(error.error || error.message || 'Request failed');
    }
    return response.json();
};

/**
 * Framework-standard hook for fetching entity data from any endpoint.
 *
 * Automatically namespaces the query key under [entityName, ...subKey] so
 * invalidation from any createModelHooks mutation fires correctly — without
 * manually aligning keys.
 *
 * The `queryFn` always receives a guaranteed non-null api function: the injected
 * api client from OttaQueryProvider when available, otherwise a raw fetch adapter.
 * No undefined-guarding required in the caller.
 *
 * @example
 * ```typescript
 * // Public blog list using a custom /api/blog/posts endpoint
 * const { data } = useEntityQuery<BlogListResponse>('posts', (api) => api('/api/blog/posts'), {
 *   subKey: ['list', { page, contentType }],
 *   ...BLOG_LIST_QUERY_CONFIG,
 * });
 *
 * // Post detail by slug
 * const { data: post } = useEntityQuery<BlogPost>('posts', (api) => api(`/api/blog/posts/by-slug/${slug}`), {
 *   subKey: ['by-slug', slug],
 *   enabled: !!slug,
 *   ...BLOG_DETAIL_QUERY_CONFIG,
 * });
 * ```
 *
 * When a post is deleted via blogPostHooks.useDelete(), the global mutation
 * observer invalidates ['posts'], which cascades to all queries starting with
 * ['posts', ...] — including the ones above — automatically.
 */
export function useEntityQuery<TData, TError = Error>(
    entityName: string,
    queryFn: (api: ApiClientFunction) => Promise<TData>,
    options?: { subKey?: readonly unknown[] } & EntityQueryOptions<TData, TError>,
) {
    const { subKey = [], ...queryOptions } = options ?? {};
    const injectedClient = useApiClient();
    const api = injectedClient ?? fetchAdapter;

    return useQuery<TData, TError>({
        queryKey: [entityName, ...subKey] as readonly unknown[],
        queryFn: () => queryFn(api),
        ...queryOptions,
    });
}
