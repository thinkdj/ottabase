// Auth routes that should never be redirect targets
const AUTH_ROUTE_PATHS = new Set(['/login', '/register', '/verify-email', '/reset-password']);

const RETURN_PATH_KEY = 'ottabase.auth.returnTo';
export const DEFAULT_AUTH_REDIRECT = '/dashboard';

/**
 * Validates and normalizes a redirect target path
 * Returns null if invalid (non-local path, auth route, etc.)
 */
function normalizeRedirectTarget(path: string | null): string | null {
    if (!path) return null;

    const target = path.trim();
    // Only allow local paths, not protocol-relative URLs
    if (!target.startsWith('/') || target.startsWith('//')) return null;

    // Extract pathname from full path (may include search/hash)
    const pathname = target.split('?')[0].split('#')[0];
    // Don't redirect to auth pages
    if (AUTH_ROUTE_PATHS.has(pathname)) return null;

    return target;
}

/**
 * Saves current path to sessionStorage for post-login redirect
 */
export function rememberReturnPath(): void {
    if (typeof window === 'undefined') return;

    const path = window.location.pathname + window.location.search + window.location.hash;
    const normalized = normalizeRedirectTarget(path);
    if (!normalized) return;

    try {
        sessionStorage.setItem(RETURN_PATH_KEY, normalized);
    } catch {
        // Ignore storage errors (private browsing, etc.)
    }
}

/**
 * Retrieves and clears stored return path
 */
function consumeReturnPath(): string | null {
    if (typeof window === 'undefined') return null;

    try {
        const path = sessionStorage.getItem(RETURN_PATH_KEY);
        if (path) sessionStorage.removeItem(RETURN_PATH_KEY);
        return normalizeRedirectTarget(path);
    } catch {
        return null;
    }
}

/**
 * Resolves redirect target for login/register pages
 * Priority: stored path > default
 */
export function resolveAuthRedirect(): string {
    if (typeof window === 'undefined') return DEFAULT_AUTH_REDIRECT;
    return consumeReturnPath() || DEFAULT_AUTH_REDIRECT;
}
