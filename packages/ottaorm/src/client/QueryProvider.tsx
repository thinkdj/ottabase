// ============================================================
// @ottabase/ottaorm/client - Query Provider
// ============================================================
// Scope-isolated QueryClient configuration for OttaORM apps
// ============================================================

import {
    MutationCache,
    QueryCache,
    QueryClient,
    QueryClientProvider,
    type Query,
    type QueryClientConfig,
} from '@tanstack/react-query';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { isApiClientError, type ApiClientFunction } from './types';

const MAX_QUERY_ATTEMPTS = 3;
const RETRYABLE_QUERY_STATUSES = new Set([0, 408, 429, 502, 503, 504]);
const NON_RETRYABLE_PLATFORM_CODES = new Set(['PLATFORM_NOT_READY', 'READONLY_MODE']);

/**
 * Visibility inputs that determine which server-side rows a browser request may
 * observe. A scope change receives an entirely new QueryClient so cached data
 * can never cross an app, tenant, principal, or authorization boundary.
 */
export interface VisibilityScope {
    appId: string;
    organizationId: string | null;
    principalId: string | null;
    authorizationVersion?: string | number | null;
}

export interface OttaQueryErrorContext {
    source: 'query' | 'mutation';
    meta?: Record<string, unknown>;
}

/**
 * Receives a terminal query or mutation error once, after query retries have
 * been exhausted. Presentation (for example, a toast) belongs in the app.
 */
export type OttaQueryErrorReporter = (error: unknown, context: OttaQueryErrorContext) => void;

/**
 * QueryClient configuration exposed by OttaORM. Cache instances are framework
 * owned so terminal error reporting cannot be bypassed accidentally.
 */
export type OttaQueryClientConfig = Omit<QueryClientConfig, 'queryCache' | 'mutationCache'>;

/**
 * Return a stable identity for a visibility scope without relying on object
 * identity or property insertion order.
 */
export function createVisibilityScopeKey(scope: VisibilityScope): string {
    return JSON.stringify([scope.appId, scope.organizationId, scope.principalId, scope.authorizationVersion ?? null]);
}

/**
 * Only structured @ottabase/api failures with explicitly transient statuses
 * are eligible for query retries. Domain, codec, and programming errors fail
 * immediately instead of repeating their network request.
 */
export function isRetryableQueryError(error: unknown): boolean {
    if (!isApiClientError(error)) return false;
    if (error.retryable !== true) return false;

    const code = error.code?.toUpperCase();
    if (code && NON_RETRYABLE_PLATFORM_CODES.has(code)) return false;

    return RETRYABLE_QUERY_STATUSES.has(error.status);
}

/**
 * TanStack calls this before incrementing failureCount. `failureCount < 2`
 * therefore allows at most three total attempts: the initial request plus two
 * retries.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    return failureCount < MAX_QUERY_ATTEMPTS - 1 && isRetryableQueryError(error);
}

/**
 * Prevent focus, reconnect, and remount events from repeatedly issuing a
 * deterministic failed request. Transient failures remain eligible.
 */
export function shouldAutoRefetchQuery(query: { state: { error: unknown } }): boolean {
    return query.state.error == null || isRetryableQueryError(query.state.error);
}

/**
 * Read TanStack's lazy AbortSignal after the current mount cycle settles.
 *
 * React StrictMode performs a subscribe/unsubscribe/subscribe cycle in one
 * task. Reading the signal synchronously makes TanStack cancel that first
 * subscription and start a duplicate request. Deferring by one microtask lets
 * the second subscription reuse the same in-flight query while preserving
 * cancellation for real unmounts, invalidation, and visibility-scope changes.
 */
export async function getStableQuerySignal(context: { readonly signal: AbortSignal }): Promise<AbortSignal> {
    await Promise.resolve();
    return context.signal;
}

function getRetryAfterMs(error: unknown): number | undefined {
    if (!isApiClientError(error)) return undefined;

    if (typeof error.retryAfterMs === 'number' && Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0) {
        return Math.min(error.retryAfterMs, 30_000);
    }

    const value = error.response?.headers.get('retry-after');
    if (!value) return undefined;

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, 30_000);
    }

    const date = Date.parse(value);
    if (Number.isNaN(date)) return undefined;
    return Math.min(Math.max(0, date - Date.now()), 30_000);
}

export function queryRetryDelay(attemptIndex: number, error: unknown): number {
    const retryAfterMs = getRetryAfterMs(error);
    if (retryAfterMs !== undefined) return retryAfterMs;

    const exponentialCap = Math.min(500 * 2 ** attemptIndex, 5_000);
    return Math.floor(Math.random() * (exponentialCap + 1));
}

/**
 * Default query configuration optimized for an edge-backed OttaORM app.
 */
export const defaultQueryConfig: OttaQueryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            refetchOnWindowFocus: shouldAutoRefetchQuery,
            refetchOnMount: shouldAutoRefetchQuery,
            refetchOnReconnect: shouldAutoRefetchQuery,
        },
        mutations: {
            // Writes may not be idempotent. Callers must implement an explicit
            // idempotency contract before repeating a mutation.
            retry: false,
        },
    },
};

const ApiClientContext = createContext<ApiClientFunction | null>(null);

/**
 * Access the mandatory framework API client.
 */
export function useApiClient(): ApiClientFunction {
    const client = useContext(ApiClientContext);
    if (!client) {
        throw new Error('useApiClient must be used within an OttaQueryProvider configured with apiClient');
    }
    return client;
}

export interface OttaQueryProviderProps {
    children: React.ReactNode;
    apiClient: ApiClientFunction;
    visibilityScope: VisibilityScope;
    errorReporter?: OttaQueryErrorReporter;
    config?: OttaQueryClientConfig;
}

type RefetchPolicy = boolean | 'always' | ((query: Query) => boolean | 'always');

function makeErrorAwareRefetchPolicy(policy: RefetchPolicy | undefined): (query: Query) => boolean | 'always' {
    return (query) => {
        if (!shouldAutoRefetchQuery(query)) return false;
        if (typeof policy === 'function') return policy(query);
        return policy ?? true;
    };
}

function reportTerminalError(
    reporter: OttaQueryErrorReporter | undefined,
    error: unknown,
    context: OttaQueryErrorContext,
): void {
    if (!reporter) return;

    try {
        reporter(error, context);
    } catch (reporterError) {
        // Error presentation must never alter query state or turn a successful
        // cache transition into another application failure.
        console.error('[OttaORM] Query errorReporter failed', reporterError);
    }
}

function usesLocalErrorPresentation(
    meta: Record<string, unknown> | undefined,
    hasLocalMutationHandler = false,
): boolean {
    const presentation = meta?.errorPresentation;
    if (presentation === 'global') return false;
    return presentation === 'local' || presentation === 'silent' || hasLocalMutationHandler;
}

/**
 * Create a scope-local QueryClient. Retry and mutation safety policies remain
 * framework-owned even when other defaults are customized.
 */
export function createQueryClient(config?: OttaQueryClientConfig, errorReporter?: OttaQueryErrorReporter): QueryClient {
    const configuredQueries = config?.defaultOptions?.queries;
    const configuredMutations = config?.defaultOptions?.mutations;

    return new QueryClient({
        ...defaultQueryConfig,
        ...config,
        queryCache: new QueryCache({
            onError: (error, query) => {
                if (usesLocalErrorPresentation(query.meta)) return;
                reportTerminalError(errorReporter, error, {
                    source: 'query',
                    meta: query.meta,
                });
            },
        }),
        mutationCache: new MutationCache({
            onError: (error, _variables, _onMutateResult, mutation) => {
                // A consumer onError conventionally owns presentation.
                // Framework callbacks that only perform rollback must stamp
                // `errorPresentation: 'global'` so failures are not hidden.
                if (usesLocalErrorPresentation(mutation.meta, Boolean(mutation.options.onError))) return;
                reportTerminalError(errorReporter, error, {
                    source: 'mutation',
                    meta: mutation.meta,
                });
            },
        }),
        defaultOptions: {
            ...defaultQueryConfig.defaultOptions,
            ...config?.defaultOptions,
            queries: {
                ...defaultQueryConfig.defaultOptions?.queries,
                ...configuredQueries,
                // Enforced framework policies.
                retry: shouldRetryQuery,
                retryDelay: queryRetryDelay,
                refetchOnWindowFocus: makeErrorAwareRefetchPolicy(configuredQueries?.refetchOnWindowFocus),
                refetchOnMount: makeErrorAwareRefetchPolicy(configuredQueries?.refetchOnMount),
                refetchOnReconnect: makeErrorAwareRefetchPolicy(configuredQueries?.refetchOnReconnect),
            },
            mutations: {
                ...defaultQueryConfig.defaultOptions?.mutations,
                ...configuredMutations,
                retry: false,
            },
        },
    });
}

/**
 * Provides a mandatory request client and an isolated QueryClient for the
 * current visibility scope.
 */
export function OttaQueryProvider({
    children,
    apiClient,
    visibilityScope,
    errorReporter,
    config,
}: OttaQueryProviderProps) {
    const scopeKey = createVisibilityScopeKey(visibilityScope);
    const reporterRef = useRef(errorReporter);
    const configRef = useRef(config);
    const activeClientRef = useRef<QueryClient | null>(null);
    reporterRef.current = errorReporter;
    configRef.current = config;

    const queryClient = useMemo(
        () =>
            createQueryClient(configRef.current, (error, context) => {
                reporterRef.current?.(error, context);
            }),
        [scopeKey],
    );

    useEffect(() => {
        activeClientRef.current = queryClient;

        return () => {
            activeClientRef.current = null;

            // React StrictMode immediately re-runs effects for the same mounted
            // client in development. Defer disposal by one microtask so that
            // simulated cleanup does not erase the live cache and issue a
            // duplicate request. A real unmount or scope replacement leaves a
            // different active client (or none), so the old scope is disposed.
            queueMicrotask(() => {
                if (activeClientRef.current === queryClient) return;
                void queryClient.cancelQueries();
                queryClient.clear();
            });
        };
    }, [queryClient]);

    return (
        // TanStack query observers retain the QueryClient they were created
        // with. The key makes a visibility change a real security boundary:
        // every observer and any component-local server data is remounted
        // against the new scope-local client.
        <QueryClientProvider key={scopeKey} client={queryClient}>
            <ApiClientContext.Provider value={apiClient}>{children}</ApiClientContext.Provider>
        </QueryClientProvider>
    );
}
