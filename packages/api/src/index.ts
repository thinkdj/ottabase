/**
 * @ottabase/api
 *
 * Single-attempt, type-safe HTTP transport with standardized errors.
 * Retry, deduplication, and presentation belong to higher-level orchestrators.
 */

// ============================================================
// Error Types
// ============================================================

import type { ApiErrorResponse } from '@ottabase/utils';

export type { ApiErrorResponse } from '@ottabase/utils';

/**
 * Custom error class for API errors.
 * Extends Error with additional metadata from the server response.
 */
export class ApiError extends Error {
    public readonly code?: string;
    public readonly details?: string;
    public readonly hint?: string;
    public readonly messages: string[];
    public readonly fieldErrors?: Record<string, string[]>;
    public readonly metadata?: ApiErrorResponse['metadata'];
    public readonly requestId?: string;
    public readonly status: number;
    public readonly response?: Response;
    /** True only when repeating a safe read can reasonably recover. */
    public readonly retryable: boolean;
    /** Server-requested retry delay parsed from Retry-After, when present. */
    public readonly retryAfterMs?: number;

    constructor(
        data: ApiErrorResponse & { status: number; retryable?: boolean; retryAfterMs?: number },
        response?: Response,
    ) {
        super(data.error);
        this.name = 'ApiError';
        this.code = data.code;
        this.details = data.details;
        this.hint = data.hint;
        this.messages = data.messages ?? [data.error];
        this.fieldErrors = data.fieldErrors;
        this.metadata = data.metadata;
        this.requestId = data.requestId;
        this.status = data.status;
        this.response = response;
        this.retryable = data.retryable ?? false;
        this.retryAfterMs = data.retryAfterMs;

        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }

    /** Check if error is a specific status code */
    is(status: number): boolean {
        return this.status === status;
    }

    /** Check if error is unauthorized (401) */
    isUnauthorized(): boolean {
        return this.status === 401;
    }

    /** Check if error is forbidden (403) */
    isForbidden(): boolean {
        return this.status === 403;
    }

    /** Check if error is not found (404) */
    isNotFound(): boolean {
        return this.status === 404;
    }

    /** Check if error is rate limited (429) */
    isRateLimited(): boolean {
        return this.status === 429;
    }

    /** Check if error is a server error (5xx) */
    isServerError(): boolean {
        return this.status >= 500 && this.status < 600;
    }

    /** Get all error messages as a single string */
    getAllMessages(): string {
        return this.messages.join(', ');
    }

    /** Convert to a plain object for logging/serialization */
    toJSON(): ApiErrorResponse & { status: number; retryable: boolean; retryAfterMs?: number } {
        return {
            error: this.message,
            code: this.code,
            details: this.details,
            hint: this.hint,
            messages: this.messages,
            fieldErrors: this.fieldErrors,
            metadata: this.metadata,
            requestId: this.requestId,
            status: this.status,
            retryable: this.retryable,
            retryAfterMs: this.retryAfterMs,
        };
    }
}

/** HTTP methods supported by the shorthand syntax */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ============================================================
// API Client Configuration
// ============================================================

export interface ApiClientConfig {
    /** Base URL for all requests (e.g., "https://api.example.com") */
    baseUrl?: string;

    /** Function to get auth token. Called before each request. */
    getAuthToken?: () => string | null | Promise<string | null>;

    /** Default headers to include in all requests */
    defaultHeaders?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);

    /** Default timeout in milliseconds (default: 30000) */
    timeout?: number;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
    /** Skip auth token injection for this request */
    skipAuth?: boolean;

    /** URL query parameters */
    params?: Record<string, string | number | boolean | undefined | null>;

    /** Request body (will be JSON stringified if object) */
    body?: unknown;

    /** Request timeout in milliseconds */
    timeout?: number;

    /** Custom headers for this request */
    headers?: Record<string, string>;
}

/** API function signature with overloads for shorthand method syntax */
export interface ApiFunction {
    /** Standard call with options object */
    <T = unknown>(endpoint: string, options?: ApiRequestOptions): Promise<T>;
    /** Shorthand call with just HTTP method */
    <T = unknown>(endpoint: string, method: HttpMethod): Promise<T>;
}

const QUERY_RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);
const NON_RETRYABLE_CODES = new Set(['PLATFORM_NOT_READY', 'READONLY_MODE']);

function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

function parseRetryAfterMs(response: Response): number | undefined {
    const value = response.headers.get('Retry-After');
    if (!value) return undefined;

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }

    const date = Date.parse(value);
    if (!Number.isFinite(date)) return undefined;
    return Math.max(0, date - Date.now());
}

function isQueryRetryableFailure(method: string, status: number, code?: string): boolean {
    return (
        (method === 'GET' || method === 'HEAD') &&
        QUERY_RETRYABLE_STATUSES.has(status) &&
        !NON_RETRYABLE_CODES.has((code ?? '').toUpperCase())
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function normalizeErrorResponse(raw: unknown, response: Response): ApiErrorResponse {
    if (!isRecord(raw)) {
        return {
            error: response.statusText || `HTTP ${response.status}`,
        };
    }

    const messages = Array.isArray(raw.messages)
        ? raw.messages.filter((message): message is string => typeof message === 'string')
        : undefined;
    const fieldErrors = isRecord(raw.fieldErrors)
        ? Object.fromEntries(
              Object.entries(raw.fieldErrors)
                  .filter((entry): entry is [string, string[]] => {
                      const [, errors] = entry;
                      return Array.isArray(errors) && errors.every((error) => typeof error === 'string');
                  })
                  .map(([field, errors]) => [field, errors]),
          )
        : undefined;

    return {
        error: optionalString(raw.error) || response.statusText || `HTTP ${response.status}`,
        code: optionalString(raw.code),
        details: optionalString(raw.details),
        hint: optionalString(raw.hint),
        messages: messages?.length ? messages : undefined,
        fieldErrors: fieldErrors && Object.keys(fieldErrors).length ? fieldErrors : undefined,
        metadata: isRecord(raw.metadata) ? (raw.metadata as ApiErrorResponse['metadata']) : undefined,
        requestId: optionalString(raw.requestId),
    };
}

class RequestTimeoutError extends Error {
    constructor() {
        super('Request timeout');
        this.name = 'RequestTimeoutError';
    }
}

function createAttemptSignal(callerSignal: AbortSignal | undefined, timeout: number) {
    const controller = new AbortController();
    let timedOut = false;

    const handleCallerAbort = () => controller.abort(abortReason(callerSignal!));
    if (callerSignal?.aborted) {
        handleCallerAbort();
    } else {
        callerSignal?.addEventListener('abort', handleCallerAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort(new DOMException('Request timed out', 'AbortError'));
    }, timeout);

    return {
        signal: controller.signal,
        didTimeOut: () => timedOut,
        dispose: () => {
            clearTimeout(timeoutId);
            callerSignal?.removeEventListener('abort', handleCallerAbort);
        },
    };
}

// ============================================================
// API Client Factory
// ============================================================

/**
 * Creates a configured API client instance.
 *
 * @example
 * ```typescript
 * // Create a client with auth
 * const api = createApiClient({
 *   baseUrl: "/api",
 *   getAuthToken: () => localStorage.getItem("token"),
 * });
 *
 * // Make requests
 * const user = await api<User>("/users/me");
 * const posts = await api<Post[]>("/posts", { params: { limit: 10 } });
 * await api("/posts", { method: "POST", body: { title: "Hello" } });
 *
 * // Shorthand syntax for simple method calls
 * await api("/posts/1", "DELETE");
 * await api("/posts/1", "GET");
 * ```
 */
export function createApiClient(config: ApiClientConfig = {}): ApiFunction {
    const { baseUrl = '', getAuthToken, defaultHeaders = {}, timeout: defaultTimeout = 30000 } = config;

    return async function api<T = unknown>(
        endpoint: string,
        optionsOrMethod: ApiRequestOptions | HttpMethod = {},
    ): Promise<T> {
        // Handle shorthand method syntax: api("/path", "DELETE")
        const options: ApiRequestOptions =
            typeof optionsOrMethod === 'string' ? { method: optionsOrMethod } : optionsOrMethod;

        const {
            skipAuth = false,
            params,
            body,
            timeout = defaultTimeout,
            headers: requestHeaders = {},
            ...fetchOptions
        } = options;

        // Build URL with query params
        let url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

        if (params) {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            }
            const queryString = searchParams.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }

        // Build headers
        const resolvedDefaultHeaders = typeof defaultHeaders === 'function' ? await defaultHeaders() : defaultHeaders;
        const headers: Record<string, string> = {
            ...resolvedDefaultHeaders,
            ...requestHeaders,
        };

        // Add auth token if available
        if (!skipAuth && getAuthToken) {
            const token = await getAuthToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // Detect FormData – skip Content-Type (browser sets multipart boundary)
        // and skip JSON.stringify so the raw FormData is sent as-is.
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

        // Add Content-Type for JSON body (skip for FormData)
        if (body !== undefined && !isFormData && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const requestBody = body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined;
        const requestMethod = (fetchOptions.method ?? 'GET').toUpperCase();
        const callerSignal = fetchOptions.signal ?? undefined;

        try {
            if (callerSignal?.aborted) {
                throw abortReason(callerSignal);
            }

            const attemptSignal = createAttemptSignal(callerSignal, timeout);
            try {
                const responseForRead = await fetch(url, {
                    ...fetchOptions,
                    headers,
                    body: requestBody,
                    signal: attemptSignal.signal,
                });

                // Handle non-OK responses.
                if (!responseForRead.ok) {
                    let errorData: ApiErrorResponse;

                    try {
                        errorData = normalizeErrorResponse(await responseForRead.json(), responseForRead);
                    } catch (error) {
                        // Cancellation and timeout apply through body consumption,
                        // not only until the response headers arrive.
                        if (
                            callerSignal?.aborted ||
                            attemptSignal.didTimeOut() ||
                            (error instanceof DOMException && error.name === 'AbortError')
                        ) {
                            throw error;
                        }
                        errorData = {
                            error: responseForRead.statusText || `HTTP ${responseForRead.status}`,
                        };
                    }

                    const apiError = new ApiError(
                        {
                            ...errorData,
                            error: errorData.error || responseForRead.statusText,
                            status: responseForRead.status,
                            retryable: isQueryRetryableFailure(requestMethod, responseForRead.status, errorData.code),
                            retryAfterMs: parseRetryAfterMs(responseForRead),
                        },
                        responseForRead,
                    );

                    throw apiError;
                }

                // Handle empty responses
                const contentType = responseForRead.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    // For non-JSON responses, there is no typed payload. Callers should use
                    // a union type (e.g. `T | void`) when invoking this helper for endpoints
                    // that may return non-JSON or empty bodies.
                    return undefined as unknown as T;
                }

                // Handle 204 No Content
                if (responseForRead.status === 204) {
                    // 204 responses are defined to have no body. Callers should use a union
                    // type (e.g. `T | void`) for endpoints that may return 204.
                    return undefined as unknown as T;
                }

                try {
                    return await responseForRead.json();
                } catch (error) {
                    if (
                        callerSignal?.aborted ||
                        attemptSignal.didTimeOut() ||
                        (error instanceof DOMException && error.name === 'AbortError')
                    ) {
                        throw error;
                    }

                    throw new ApiError(
                        {
                            error: 'Invalid JSON response',
                            code: 'INVALID_RESPONSE',
                            status: responseForRead.status,
                            retryable: false,
                        },
                        responseForRead,
                    );
                }
            } catch (error) {
                if (callerSignal?.aborted) {
                    throw error;
                }
                throw attemptSignal.didTimeOut() ? new RequestTimeoutError() : error;
            } finally {
                attemptSignal.dispose();
            }
        } catch (error) {
            // Re-throw ApiError as-is
            if (error instanceof ApiError) {
                throw error;
            }

            // Handle abort/timeout
            if (error instanceof RequestTimeoutError) {
                const timeoutError = new ApiError({
                    error: 'Request timeout',
                    code: 'TIMEOUT',
                    details: `Request to ${endpoint} timed out after ${timeout}ms`,
                    status: 0,
                    retryable: requestMethod === 'GET' || requestMethod === 'HEAD',
                });
                throw timeoutError;
            }

            // Preserve caller cancellation so TanStack Query can discard it without
            // surfacing a network error or scheduling another attempt.
            if (callerSignal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
                throw error;
            }

            // Handle network errors
            const networkError = new ApiError({
                error: error instanceof Error ? error.message : 'Network error',
                code: 'NETWORK_ERROR',
                details: 'Unable to connect to the server',
                status: 0,
                retryable: requestMethod === 'GET' || requestMethod === 'HEAD',
            });

            throw networkError;
        }
    };
}

// ============================================================
// Default API Client
// ============================================================

/**
 * Default API client with no configuration.
 * Use `createApiClient()` for customized clients.
 *
 * @example
 * ```typescript
 * import { api } from "@ottabase/api";
 *
 * // Standard call
 * const data = await api<{ message: string }>("/api/health");
 *
 * // With options
 * await api("/api/posts", { method: "POST", body: { title: "Hello" } });
 *
 * // Shorthand for simple method calls
 * await api("/api/posts/1", "DELETE");
 * ```
 */
export const api: ApiFunction = createApiClient();

// ============================================================
// Type Guards
// ============================================================

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/**
 * Helper to safely extract error message from any error
 */
export function getErrorMessage(error: unknown): string {
    if (isApiError(error)) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unknown error occurred';
}

/**
 * Helper to safely extract all messages from an error
 */
export function getErrorMessages(error: unknown): string[] {
    if (isApiError(error)) {
        return error.messages;
    }
    return [getErrorMessage(error)];
}
