/**
 * Configured API client for the Vite app.
 * - Request-only transport (presentation happens at the Query boundary)
 * - Type-safe error handling
 * - x-app-id and x-org-id headers from global state
 */

import { appIdAtom, globalStore, isAuthenticatedAtom, organizationIdAtom, userAtom } from '@/ottabase/state/appState';
import { ApiError, createApiClient } from '@ottabase/api';
import { AUTH_STORAGE_KEY, invalidateAuthSession } from '@ottabase/auth/react';
import { toast } from 'sonner';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';
let authInvalidationStarted = false;

/**
 * Get auth token from storage/context.
 */
function getAuthToken(): string | null {
    // Cookie-based sessions do not require a bearer token by default.
    return null;
}

/**
 * Get current app ID from global state.
 * Falls back to reading from atom if available.
 */
function getAppId(): string | null {
    try {
        return globalStore.get(appIdAtom) ?? null;
    } catch {
        return null;
    }
}

/**
 * Get current organization ID from global state.
 * Falls back to localStorage if state not yet initialized.
 */
function getOrganizationId(): string | null {
    // Never send org context when not authenticated.
    try {
        const isAuthenticated = globalStore.get(isAuthenticatedAtom);
        if (!isAuthenticated) {
            return null;
        }
    } catch {
        // ignore atom read issues and continue to storage fallback
    }

    try {
        const orgId = globalStore.get(organizationIdAtom);
        if (orgId) return orgId;
    } catch {
        // State not yet initialized, try localStorage fallback
    }

    try {
        const sessionRaw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!sessionRaw) return null;
        const session = JSON.parse(sessionRaw) as { user?: { organizationId?: string | null } };
        return session.user?.organizationId ?? null;
    } catch {
        return null;
    }
}

/**
 * Report one terminal framework request failure.
 *
 * OttaQueryProvider invokes this after its retry budget is exhausted. Keeping
 * presentation here, rather than inside the transport, prevents intermediate
 * attempts and deduped observers from producing duplicate toasts.
 */
export function reportApiError(error: unknown): void {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return;
    }

    if (!(error instanceof ApiError)) {
        console.error('Unexpected query error:', error);
        toast.error('Something went wrong');
        return;
    }

    // Skip toast for certain error types that are handled locally
    if (error.code === 'HANDLED' || error.status === 422) {
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
        handleUnauthorized();
        return;
    }

    if (error.isForbidden()) {
        toast.error('Access denied', {
            description: error.hint || 'Your account does not have permission to perform this action.',
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
                    : (typeof error.details === 'string' ? error.details : undefined) ||
                      error.hint ||
                      'Something went wrong',
        });
        return;
    }

    // Default error toast
    toast.error(error.message, {
        description:
            error.messages.length > 1
                ? error.messages.join(' • ')
                : (typeof error.details === 'string' ? error.details : undefined) || error.hint,
    });
}

function handleUnauthorized(): void {
    // A successful sign-in can occur without reloading the module (for example
    // while already on /login). Re-arm the guard for that new session.
    if (authInvalidationStarted) {
        try {
            if (globalStore.get(isAuthenticatedAtom)) {
                authInvalidationStarted = false;
            }
        } catch {
            // Keep the existing guard when auth state cannot be read.
        }
    }

    if (authInvalidationStarted) return;
    authInvalidationStarted = true;

    toast.error('Session expired', {
        description: 'Please log in again',
    });
    invalidateAuthSession();
    try {
        globalStore.set(organizationIdAtom, null);
        globalStore.set(isAuthenticatedAtom, false);
        globalStore.set(userAtom, null);
    } catch {
        // ignore store update failures
    }
    try {
        localStorage.removeItem(CURRENT_ORG_KEY);
    } catch {
        // ignore storage failures
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
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
 * // Transport errors are always thrown; interaction/query boundaries present them.
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
    defaultHeaders: () => {
        const headers: Record<string, string> = {
            Accept: 'application/json',
        };

        // Read appId from global state
        const appId = getAppId();
        if (appId) {
            headers['X-App-Id'] = appId;
        }

        // Read organizationId from global state
        const organizationId = getOrganizationId();
        if (organizationId) {
            headers['X-Org-Id'] = organizationId;
        }

        return headers;
    },
    timeout: 30000,
});

// Re-export types for convenience
export { ApiError, getErrorMessage, getErrorMessages, isApiError } from '@ottabase/api';
export type { ApiClientConfig, ApiErrorResponse, ApiFunction, ApiRequestOptions, HttpMethod } from '@ottabase/api';
