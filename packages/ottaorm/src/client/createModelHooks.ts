// ============================================================
// @ottabase/ottaorm/client - Model Hooks Factory
// ============================================================
// Creates type-safe TanStack Query hooks for any OttaORM model
// ============================================================

import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type InfiniteData,
} from "@tanstack/react-query";
import type {
  ModelQueryConfig,
  QueryOptions,
  PaginationResult,
  MutationContext,
  ApiClientFunction,
} from "./types";
import { createQueryKeys } from "./types";
import { useApiClient } from "./QueryProvider";

/**
 * Create a complete set of query hooks for an OttaORM model
 *
 * @example
 * ```typescript
 * // Define your model type
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * // Create hooks (uses /api/ottaorm/users by default)
 * const userHooks = createModelHooks<User>({ entityName: "users" });
 *
 * // Or with a custom API path
 * const userHooks = createModelHooks<User>({
 *   entityName: "users",
 *   apiPath: "/api/custom/users",
 * });
 *
 * // Use in components
 * function UserList() {
 *   const { data: users, isLoading } = userHooks.useList();
 *   const createUser = userHooks.useCreate();
 *
 *   return (
 *     <div>
 *       {users?.map(user => <div key={user.id}>{user.name}</div>)}
 *       <button onClick={() => createUser.mutate({ name: "New User" })}>
 *         Add User
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function createModelHooks<T extends { id: string | number }>(
  config: ModelQueryConfig
) {
  const { entityName } = config;
  // Default to /api/ottaorm/{entityName} for the generic CRUD handler
  const apiPath = config.apiPath ?? `/api/ottaorm/${entityName}`;
  const queryKeys = createQueryKeys(entityName);

  // ============================================================
  // API Fetcher Factory - Creates fetchers that use API client
  // ============================================================

  function createFetchers(apiClient: ApiClientFunction | undefined) {
    async function fetchList(options?: QueryOptions): Promise<T[]> {
      const params = new URLSearchParams();

      if (options?.where) {
        params.set("where", JSON.stringify(options.where));
      }
      if (options?.orderBy) {
        params.set("orderBy", options.orderBy);
      }
      if (options?.orderDirection) {
        params.set("orderDirection", options.orderDirection);
      }
      if (options?.limit) {
        params.set("limit", String(options.limit));
      }
      if (options?.offset) {
        params.set("offset", String(options.offset));
      }

      const queryString = params.toString();
      const url = queryString ? `${apiPath}?${queryString}` : apiPath;

      // Use API client if available, otherwise fall back to fetch
      if (apiClient) {
        const result = await apiClient<Record<string, T[]> & { data?: T[] }>(url);
        return result[entityName] || result.data || (result as unknown as T[]);
      }

      // Fallback to raw fetch
      const response = await fetch(url);
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || `Failed to fetch ${entityName}`);
      }

      const result = (await response.json()) as Record<string, T[]> & { data?: T[] };
      return result[entityName] || result.data || (result as unknown as T[]);
    }

    async function fetchDetail(id: string | number): Promise<T | null> {
      const url = `${apiPath}/${id}`;

      // Use API client if available
      if (apiClient) {
        try {
          const result = await apiClient<Record<string, T> & { data?: T }>(url);
          return result[entityName.slice(0, -1)] || result.data || (result as unknown as T);
        } catch (error: any) {
          if (error?.status === 404) return null;
          throw error;
        }
      }

      // Fallback to raw fetch
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) return null;
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || `Failed to fetch ${entityName}`);
      }

      const result = (await response.json()) as Record<string, T> & { data?: T };
      return result[entityName.slice(0, -1)] || result.data || (result as unknown as T);
    }

    async function fetchPaginated(
      page: number,
      perPage: number,
      options?: Omit<QueryOptions, "offset" | "limit">
    ): Promise<PaginationResult<T>> {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(perPage));

      if (options?.where) {
        params.set("where", JSON.stringify(options.where));
      }
      if (options?.orderBy) {
        params.set("orderBy", options.orderBy);
      }
      if (options?.orderDirection) {
        params.set("orderDirection", options.orderDirection);
      }

      const url = `${apiPath}?${params.toString()}`;

      // Use API client if available
      if (apiClient) {
        return await apiClient<PaginationResult<T>>(url);
      }

      // Fallback to raw fetch
      const response = await fetch(url);
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || `Failed to fetch ${entityName}`);
      }

      return response.json() as Promise<PaginationResult<T>>;
    }

    async function createItem(data: Partial<T>): Promise<T> {
      // Use API client if available
      if (apiClient) {
        const result = await apiClient<Record<string, T> & { data?: T }>(apiPath, {
          method: "POST",
          body: data,
        });
        return result[entityName.slice(0, -1)] || result.data || (result as unknown as T);
      }

      // Fallback to raw fetch
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || `Failed to create ${entityName}`);
      }

      const result = (await response.json()) as Record<string, T> & { data?: T };
      return result[entityName.slice(0, -1)] || result.data || (result as unknown as T);
    }

    async function updateItem(id: string | number, data: Partial<T>): Promise<T> {
      const url = `${apiPath}/${id}`;

      // Use API client if available
      if (apiClient) {
        const result = await apiClient<Record<string, T> & { data?: T }>(url, {
          method: "PATCH",
          body: data,
        });
        return result[entityName.slice(0, -1)] || result.data || (result as unknown as T);
      }

      // Fallback to raw fetch
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || `Failed to update ${entityName}`);
      }

      const result = (await response.json()) as Record<string, T> & { data?: T };
      return result[entityName.slice(0, -1)] || result.data || (result as unknown as T);
    }

    async function deleteItem(id: string | number): Promise<boolean> {
      const url = `${apiPath}/${id}`;

      // Use API client if available
      if (apiClient) {
        await apiClient(url, { method: "DELETE" });
        return true;
      }

      // Fallback to raw fetch
      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || `Failed to delete ${entityName}`);
      }

      return true;
    }

    return {
      fetchList,
      fetchDetail,
      fetchPaginated,
      createItem,
      updateItem,
      deleteItem,
    };
  }

  // ============================================================
  // Query Hooks
  // ============================================================

  function useList(
    options?: QueryOptions,
    queryOptions?: Partial<UseQueryOptions<T[], Error>>
  ) {
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return useQuery<T[], Error>({
      queryKey: queryKeys.list(options),
      queryFn: () => fetchers.fetchList(options),
      ...queryOptions,
    });
  }

  function useDetail(
    id: string | number,
    queryOptions?: Partial<UseQueryOptions<T | null, Error>>
  ) {
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return useQuery<T | null, Error>({
      queryKey: queryKeys.detail(id),
      queryFn: () => fetchers.fetchDetail(id),
      enabled: !!id,
      ...queryOptions,
    });
  }

  function useInfiniteList(
    options?: Omit<QueryOptions, "offset" | "limit">,
    perPage: number = 10
  ) {
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return useInfiniteQuery<
      PaginationResult<T>,
      Error,
      InfiniteData<PaginationResult<T>>,
      ReturnType<typeof queryKeys.infinite>,
      number
    >({
      queryKey: queryKeys.infinite(options),
      queryFn: ({ pageParam }) => fetchers.fetchPaginated(pageParam, perPage, options),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.hasNextPage ? lastPage.page + 1 : undefined,
      getPreviousPageParam: (firstPage) =>
        firstPage.hasPrevPage ? firstPage.page - 1 : undefined,
    });
  }

  // ============================================================
  // Mutation Hooks
  // ============================================================

  function useCreate(
    mutationOptions?: Partial<UseMutationOptions<T, Error, Partial<T>, MutationContext<T>>>
  ) {
    const queryClient = useQueryClient();
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return useMutation<T, Error, Partial<T>, MutationContext<T>>({
      mutationFn: fetchers.createItem,
      onSettled: (...args) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
        mutationOptions?.onSettled?.(...args);
      },
      ...mutationOptions,
    });
  }

  function useUpdate(
    mutationOptions?: Partial<
      UseMutationOptions<T, Error, { id: string | number; data: Partial<T> }, MutationContext<T>>
    >
  ) {
    const queryClient = useQueryClient();
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return useMutation<
      T,
      Error,
      { id: string | number; data: Partial<T> },
      MutationContext<T>
    >({
      mutationFn: ({ id, data }) => fetchers.updateItem(id, data),
      onSettled: (...args) => {
        if (args[2]) {
          queryClient.invalidateQueries({ queryKey: queryKeys.detail(args[2].id) });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
        mutationOptions?.onSettled?.(...args);
      },
      ...mutationOptions,
    });
  }

  function useDelete(
    mutationOptions?: Partial<
      UseMutationOptions<boolean, Error, string | number, MutationContext<T>>
    >
  ) {
    const queryClient = useQueryClient();
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return useMutation<boolean, Error, string | number, MutationContext<T>>({
      mutationFn: fetchers.deleteItem,
      onSettled: (...args) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
        mutationOptions?.onSettled?.(...args);
      },
      ...mutationOptions,
    });
  }

  // ============================================================
  // Utility Hooks
  // ============================================================

  function usePrefetch() {
    const queryClient = useQueryClient();
    const apiClient = useApiClient();
    const fetchers = useMemo(() => createFetchers(apiClient), [apiClient]);

    return {
      prefetchList: async (options?: QueryOptions) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.list(options),
          queryFn: () => fetchers.fetchList(options),
        });
      },
      prefetchDetail: async (id: string | number) => {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.detail(id),
          queryFn: () => fetchers.fetchDetail(id),
        });
      },
    };
  }

  function useInvalidate() {
    const queryClient = useQueryClient();

    return {
      invalidateAll: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.all() }),
      invalidateList: (options?: QueryOptions) =>
        queryClient.invalidateQueries({ queryKey: queryKeys.list(options) }),
      invalidateDetail: (id: string | number) =>
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) }),
    };
  }

  // ============================================================
  // Return All Hooks & Utilities
  // ============================================================

  return {
    // Query hooks
    useList,
    useDetail,
    useInfiniteList,

    // Mutation hooks
    useCreate,
    useUpdate,
    useDelete,

    // Utility hooks
    usePrefetch,
    useInvalidate,

    // Query keys for manual cache manipulation
    queryKeys,

    // Raw fetchers (for server-side or manual use)
    // Note: These use raw fetch, not the injected API client
    fetchers: createFetchers(undefined),
  };
}
