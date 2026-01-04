/**
 * Configured API client for the TanStack app.
 * - Automatic error toast notifications
 * - Auth token injection (when implemented)
 * - Type-safe error handling
 */

import { createApiClient, type ApiError } from "@ottabase/api";
import { toast } from "@ottabase/ui-shadcn";

/**
 * Get auth token from storage/context.
 * TODO: Implement when auth is added.
 */
function getAuthToken(): string | null {
  // Future: return localStorage.getItem("authToken") or session token
  return null;
}

/**
 * Global error handler for API errors.
 * Shows toast notifications for errors.
 */
function handleApiError(error: ApiError): void {
  // Skip toast for certain error types that are handled locally
  if (error.code === "HANDLED") {
    return;
  }

  // Show different toast styles based on error type
  if (error.isUnauthorized()) {
    toast.error("Session expired", {
      description: "Please log in again",
    });
    // TODO: Redirect to login
    return;
  }

  if (error.isRateLimited()) {
    toast.error("Too many requests", {
      description: error.hint || "Please wait a moment and try again",
    });
    return;
  }

  if (error.isServerError()) {
    toast.error(error.message, {
      description: error.messages.length > 1
        ? error.messages.join(" • ")
        : error.details || error.hint || "Something went wrong",
    });
    return;
  }

  // Default error toast
  toast.error(error.message, {
    description: error.messages.length > 1
      ? error.messages.join(" • ")
      : error.details || error.hint,
  });
}

/**
 * Configured API client for the app.
 *
 * @example
 * ```typescript
 * import { api } from "@/lib/api";
 *
 * // Simple GET
 * const data = await api<User>("/api/users/me");
 *
 * // GET with params
 * const posts = await api<Post[]>("/api/posts", {
 *   params: { limit: 10, page: 1 }
 * });
 *
 * // POST with body
 * const newPost = await api<Post>("/api/posts", {
 *   method: "POST",
 *   body: { title: "Hello", content: "World" }
 * });
 *
 * // Shorthand syntax for simple method calls
 * await api("/api/posts/1", "DELETE");
 * await api("/api/posts/1", "GET");
 *
 * // Skip global error handling for local handling
 * try {
 *   await api("/api/sensitive", { skipAuth: true });
 * } catch (error) {
 *   // Handle locally
 * }
 * ```
 */
export const api = createApiClient({
  baseUrl: "",
  getAuthToken,
  onError: handleApiError,
  onUnauthorized: (error) => {
    // TODO: Clear auth state and redirect to login
    console.log("Unauthorized:", error.message);
  },
  defaultHeaders: {
    Accept: "application/json",
  },
  timeout: 30000,
});

// Re-export types for convenience
export { ApiError, isApiError, getErrorMessage, getErrorMessages } from "@ottabase/api";
export type { ApiErrorResponse, ApiClientConfig, ApiRequestOptions, HttpMethod, ApiFunction } from "@ottabase/api";
