// ============================================================
// @ottabase/ottaorm/client - Generic API Query Hooks
// ============================================================
// For custom endpoints that don't follow the model pattern
// ============================================================

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { useApiClient } from "./QueryProvider";

/**
 * Generic API query hook for custom endpoints
 *
 * @example
 * ```typescript
 * // GET request
 * const { data, isLoading } = useApiQuery<Stats>({
 *   queryKey: ["stats", "dashboard"],
 *   endpoint: "/api/stats/dashboard",
 * });
 *
 * // With transform
 * const { data } = useApiQuery<RawData, TransformedData>({
 *   queryKey: ["data"],
 *   endpoint: "/api/data",
 *   transform: (raw) => transformData(raw),
 * });
 * ```
 */
export function useApiQuery<TData, TTransformed = TData>(options: {
  queryKey: QueryKey;
  endpoint: string;
  method?: "GET" | "POST";
  body?: unknown;
  transform?: (data: TData) => TTransformed;
  fetchOptions?: RequestInit;
  queryOptions?: Partial<UseQueryOptions<TTransformed, Error>>;
}) {
  const {
    queryKey,
    endpoint,
    method = "GET",
    body,
    transform,
    fetchOptions,
    queryOptions,
  } = options;

  const apiClient = useApiClient();

  return useQuery<TTransformed, Error>({
    queryKey,
    queryFn: async (): Promise<TTransformed> => {
      // Use injected API client if available, otherwise fall back to raw fetch
      if (apiClient) {
        const data = await apiClient<TData>(endpoint, {
          method,
          body,
        });
        return (transform ? transform(data) : data) as TTransformed;
      }

      // Fallback to raw fetch for backward compatibility
      const response = await fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(error.error || error.message || "Request failed");
      }

      const data = (await response.json()) as TData;
      return (transform ? transform(data) : data) as TTransformed;
    },
    ...queryOptions,
  });
}

/**
 * Generic API mutation hook for custom endpoints
 *
 * @example
 * ```typescript
 * const mutation = useApiMutation<{ success: boolean }, FormData>({
 *   endpoint: "/api/custom-action",
 *   method: "POST",
 *   invalidateKeys: [["list"], ["stats"]],
 * });
 *
 * // Usage
 * mutation.mutate({ field: "value" });
 * ```
 */
export function useApiMutation<TData, TVariables = unknown>(options: {
  endpoint: string | ((variables: TVariables) => string);
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  invalidateKeys?: QueryKey[];
  mutationOptions?: Partial<UseMutationOptions<TData, Error, TVariables>>;
}) {
  const {
    endpoint,
    method = "POST",
    invalidateKeys = [],
    mutationOptions,
  } = options;
  const queryClient = useQueryClient();
  const apiClient = useApiClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables): Promise<TData> => {
      const url = typeof endpoint === "function" ? endpoint(variables) : endpoint;

      // Use injected API client if available
      if (apiClient) {
        return await apiClient<TData>(url, {
          method,
          body: method !== "DELETE" ? variables : undefined,
        });
      }

      // Fallback to raw fetch for backward compatibility
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method !== "DELETE" ? JSON.stringify(variables) : undefined,
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(error.error || error.message || "Request failed");
      }

      return response.json() as Promise<TData>;
    },
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    ...mutationOptions,
  });
}

/**
 * Hook for batch operations
 *
 * @example
 * ```typescript
 * const batchDelete = useBatchMutation<boolean, string[]>({
 *   endpoint: "/api/users/batch-delete",
 *   invalidateKeys: [["users"]],
 * });
 *
 * // Delete multiple items
 * batchDelete.mutate(["id1", "id2", "id3"]);
 * ```
 */
export function useBatchMutation<TData, TVariables extends unknown[]>(options: {
  endpoint: string;
  method?: "POST" | "DELETE";
  invalidateKeys?: QueryKey[];
  mutationOptions?: Partial<UseMutationOptions<TData, Error, TVariables>>;
}) {
  return useApiMutation<TData, TVariables>(options);
}
