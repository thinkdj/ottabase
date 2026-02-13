/**
 * Configured API client for the TanStack app.
 * - Automatic error toast notifications
 * - Auth token injection (when implemented)
 * - Type-safe error handling
 */

import { APP_ID } from '@/ottabase/config/app.config';
import { createApiClient, type ApiError } from '@ottabase/api';
import { toast } from 'sonner';

/**
 * Get auth token from storage/context.
 */
function getAuthToken(): string | null {
    // Cookie-based Auth.js sessions do not require a bearer token by default.
    return null;
}

function getOrganizationId(): string | null {
    try {
        const stored = localStorage.getItem('currentOrgId');
        if (stored) return stored;
    } catch {
        // ignore
    }

    try {
        const sessionRaw = localStorage.getItem('auth_session');
        if (!sessionRaw) return null;
        const session = JSON.parse(sessionRaw) as { user?: { organizationId?: string | null } };
        return session.user?.organizationId ?? null;
    } catch {
        return null;
    }
}

/**
 * Global error handler for API errors.
 * Shows toast notifications for errors.
 */
function handleApiError(error: ApiError): void {
    // Skip toast for certain error types that are handled locally
    if (error.code === 'HANDLED') {
        return;
    }

    if (error.status === 503) {
        const code = (error.code || '').toUpperCase();

        // Platform not initialized → redirect to bootstrap wizard
        if (code === 'PLATFORM_NOT_READY') {
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/__bootstrap__')) {
                window.location.href = '/__bootstrap__';
            }
            return;
        }

        const message =
            code === 'READONLY_MODE'
                ? 'The platform is in read-only mode'
                : error.message?.toLowerCase().includes('lockdown')
                  ? 'Lockdown enforced'
                  : 'Service temporarily unavailable';
        toast.error(message, {
            description: error.hint || 'Please try again shortly.',
        });
        return;
    }

    // Show different toast styles based on error type
    if (error.isUnauthorized()) {
        toast.error('Session expired', {
            description: 'Please log in again',
        });
        return;
    }

    if (error.isRateLimited()) {
        toast.error('Too many requests', {
            description: error.hint || 'Please wait a moment and try again',
        });
        return;
    }

    if (error.isServerError()) {
        toast.error(error.message, {
            description:
                error.messages.length > 1
                    ? error.messages.join(' • ')
                    : error.details || error.hint || 'Something went wrong',
        });
        return;
    }

    // Default error toast
    toast.error(error.message, {
        description: error.messages.length > 1 ? error.messages.join(' • ') : error.details || error.hint,
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
    baseUrl: '',
    getAuthToken,
    onError: handleApiError,
    onUnauthorized: (error) => {
        try {
            localStorage.removeItem('auth_session');
        } catch {
            // ignore
        }

        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    },
    defaultHeaders: () => {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'X-App-Id': APP_ID,
        };
        const organizationId = getOrganizationId();
        if (organizationId) {
            headers['X-Organization-Id'] = organizationId;
        }
        return headers;
    },
    timeout: 30000,
});

// Re-export types for convenience
export { ApiError, getErrorMessage, getErrorMessages, isApiError } from '@ottabase/api';
export type { ApiClientConfig, ApiErrorResponse, ApiFunction, ApiRequestOptions, HttpMethod } from '@ottabase/api';
