// ============================================================
// @ottabase/ottaorm/client - Query Provider
// ============================================================
// Optimized QueryClient configuration for OttaORM apps
// ============================================================

import React, { useState, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import type { ApiClientFunction } from './types';

/**
 * Default query client configuration optimized for OttaORM
 */
export const defaultQueryConfig: QueryClientConfig = {
    defaultOptions: {
        queries: {
            // Stale time: 30 seconds - data is considered fresh for this duration
            staleTime: 30 * 1000,
            // Cache time: 5 minutes - unused data is garbage collected after this
            gcTime: 5 * 60 * 1000,
            // Retry 3 times with exponential backoff
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Refetch on window focus for real-time feel
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: true,
            // Refetch on reconnect for offline support
            refetchOnReconnect: true,
        },
        mutations: {
            // Retry mutations once
            retry: 1,
            retryDelay: 1000,
        },
    },
};

/**
 * Context for providing API client to hooks
 */
const ApiClientContext = createContext<ApiClientFunction | undefined>(undefined);

/**
 * Hook to access the injected API client
 */
export function useApiClient(): ApiClientFunction | undefined {
    return useContext(ApiClientContext);
}

/**
 * Configuration options for OttaQueryProvider
 */
export interface OttaQueryProviderProps {
    children: React.ReactNode;
    /** Override default query client configuration */
    config?: Partial<QueryClientConfig>;
    /** Provide your own QueryClient instance */
    client?: QueryClient;
    /** Provide a custom API client function (e.g., from @ottabase/api) */
    apiClient?: ApiClientFunction;
}

/**
 * Optimized Query Provider for OttaORM applications
 *
 * @example
 * ```tsx
 * // Basic usage (uses optimized defaults)
 * import { OttaQueryProvider } from "@ottabase/ottaorm/client";
 *
 * function App() {
 *   return (
 *     <OttaQueryProvider>
 *       <YourApp />
 *     </OttaQueryProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Custom configuration
 * <OttaQueryProvider
 *   config={{
 *     defaultOptions: {
 *       queries: {
 *         staleTime: 60 * 1000, // 1 minute
 *       },
 *     },
 *   }}
 * >
 *   <YourApp />
 * </OttaQueryProvider>
 * ```
 */
export function OttaQueryProvider({ children, config, client, apiClient }: OttaQueryProviderProps) {
    const [queryClient] = useState(
        () =>
            client ??
            new QueryClient({
                ...defaultQueryConfig,
                ...config,
                defaultOptions: {
                    ...defaultQueryConfig.defaultOptions,
                    ...config?.defaultOptions,
                    queries: {
                        ...defaultQueryConfig.defaultOptions?.queries,
                        ...config?.defaultOptions?.queries,
                    },
                    mutations: {
                        ...defaultQueryConfig.defaultOptions?.mutations,
                        ...config?.defaultOptions?.mutations,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ApiClientContext.Provider value={apiClient}>{children}</ApiClientContext.Provider>
        </QueryClientProvider>
    );
}

/**
 * Create a pre-configured QueryClient
 *
 * @example
 * ```typescript
 * const queryClient = createQueryClient({
 *   defaultOptions: {
 *     queries: {
 *       staleTime: 60 * 1000,
 *     },
 *   },
 * });
 * ```
 */
export function createQueryClient(config?: Partial<QueryClientConfig>): QueryClient {
    return new QueryClient({
        ...defaultQueryConfig,
        ...config,
        defaultOptions: {
            ...defaultQueryConfig.defaultOptions,
            ...config?.defaultOptions,
            queries: {
                ...defaultQueryConfig.defaultOptions?.queries,
                ...config?.defaultOptions?.queries,
            },
            mutations: {
                ...defaultQueryConfig.defaultOptions?.mutations,
                ...config?.defaultOptions?.mutations,
            },
        },
    });
}
