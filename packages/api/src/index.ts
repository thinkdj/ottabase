/**
 * @ottabase/api
 *
 * Type-safe API client with standardized error handling.
 * Supports auth token injection, configurable base URLs, and error callbacks.
 */

// ============================================================
// Error Types
// ============================================================

/**
 * Standardized API error response from the server.
 * All API endpoints should return errors in this format.
 */
export interface ApiErrorResponse {
  /** Primary error message */
  error: string;
  /** Error code for programmatic handling (e.g., "UNAUTHORIZED", "RATE_LIMITED") */
  code?: string;
  /** Additional context about the error */
  details?: string;
  /** Actionable suggestion for fixing the error */
  hint?: string;
  /** Multiple error messages (e.g., validation errors) */
  messages?: string[];
  /** Field-specific errors for form validation */
  fieldErrors?: Record<string, string[]>;
}

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
  public readonly status: number;
  public readonly response?: Response;

  constructor(
    data: ApiErrorResponse & { status: number },
    response?: Response,
  ) {
    super(data.error);
    this.name = "ApiError";
    this.code = data.code;
    this.details = data.details;
    this.hint = data.hint;
    this.messages = data.messages ?? [data.error];
    this.fieldErrors = data.fieldErrors;
    this.status = data.status;
    this.response = response;

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
    return this.messages.join(", ");
  }

  /** Convert to a plain object for logging/serialization */
  toJSON(): ApiErrorResponse & { status: number } {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      hint: this.hint,
      messages: this.messages,
      fieldErrors: this.fieldErrors,
      status: this.status,
    };
  }
}

// ============================================================
// API Client Configuration
// ============================================================

export interface ApiClientConfig {
  /** Base URL for all requests (e.g., "https://api.example.com") */
  baseUrl?: string;

  /** Function to get auth token. Called before each request. */
  getAuthToken?: () => string | null | Promise<string | null>;

  /** Global error handler. Called for all errors. */
  onError?: (error: ApiError) => void;

  /** Called when a 401 is received. Useful for redirecting to login. */
  onUnauthorized?: (error: ApiError) => void;

  /** Default headers to include in all requests */
  defaultHeaders?: Record<string, string>;

  /** Default timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
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

/** HTTP methods supported by the shorthand syntax */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** API function signature with overloads for shorthand method syntax */
export interface ApiFunction {
  /** Standard call with options object */
  <T = unknown>(endpoint: string, options?: ApiRequestOptions): Promise<T>;
  /** Shorthand call with just HTTP method */
  <T = unknown>(endpoint: string, method: HttpMethod): Promise<T>;
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
 *   onUnauthorized: () => redirect("/login"),
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
  const {
    baseUrl = "",
    getAuthToken,
    onError,
    onUnauthorized,
    defaultHeaders = {},
    timeout: defaultTimeout = 30000,
  } = config;

  return async function api<T = unknown>(
    endpoint: string,
    optionsOrMethod: ApiRequestOptions | HttpMethod = {},
  ): Promise<T> {
    // Handle shorthand method syntax: api("/path", "DELETE")
    const options: ApiRequestOptions =
      typeof optionsOrMethod === "string"
        ? { method: optionsOrMethod }
        : optionsOrMethod;

    const {
      skipAuth = false,
      params,
      body,
      timeout = defaultTimeout,
      headers: requestHeaders = {},
      ...fetchOptions
    } = options;

    // Build URL with query params
    let url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...requestHeaders,
    };

    // Add auth token if available
    if (!skipAuth && getAuthToken) {
      const token = await getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    // Add Content-Type for JSON body
    if (body !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        let errorData: ApiErrorResponse;

        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: response.statusText || `HTTP ${response.status}`,
          };
        }

        const apiError = new ApiError(
          {
            ...errorData,
            error: errorData.error || response.statusText,
            status: response.status,
          },
          response,
        );

        // Call error handlers
        if (onUnauthorized && apiError.isUnauthorized()) {
          onUnauthorized(apiError);
        }

        if (onError) {
          onError(apiError);
        }

        throw apiError;
      }

      // Handle empty responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // For non-JSON responses, there is no typed payload. Callers should use
        // a union type (e.g. `T | void`) when invoking this helper for endpoints
        // that may return non-JSON or empty bodies.
        return undefined as unknown as T;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        // 204 responses are defined to have no body. Callers should use a union
        // type (e.g. `T | void`) for endpoints that may return 204.
        return undefined as unknown as T;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        const timeoutError = new ApiError({
          error: "Request timeout",
          code: "TIMEOUT",
          details: `Request to ${endpoint} timed out after ${timeout}ms`,
          status: 0,
        });

        if (onError) {
          onError(timeoutError);
        }

        throw timeoutError;
      }

      // Handle network errors
      const networkError = new ApiError({
        error: error instanceof Error ? error.message : "Network error",
        code: "NETWORK_ERROR",
        details: "Unable to connect to the server",
        status: 0,
      });

      if (onError) {
        onError(networkError);
      }

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
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
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
