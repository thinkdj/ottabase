// ============================================================
// @ottabase/query - TanStack Query Integration for OttaORM
// ============================================================
// Type-safe data fetching with automatic caching and mutations
// ============================================================

// Types
export * from "./types";

// Hooks
export * from "./hooks";

// Provider
export * from "./provider";

// Re-export commonly used TanStack Query exports for convenience
export {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  useIsFetching,
  useIsMutating,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
