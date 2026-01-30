/**
 * Convert a string into a URL-friendly slug.
 * @example makeSlug("Hello World!") // "hello-world"
 * @example makeSlug("Hello World!", "_") // "hello_world"
 */
export function makeSlug(str: string, replaceSpaceWith: string = '-'): string {
    if (!str) return '';
    // Normalize Unicode characters (e.g., é → e, ñ → n)
    const normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Clean up the string
    const cleaned = normalized
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove any special characters that aren't letters, numbers, spaces, or hyphens
        .replace(/[\s/]+/g, replaceSpaceWith) // replace any spaces or forward slashes with replacement character
        .replace(new RegExp(`${escapeRegex(replaceSpaceWith)}+`, 'g'), replaceSpaceWith); // Replace multiple replacement characters with single
    return cleaned
        .replace(new RegExp(`^${escapeRegex(replaceSpaceWith)}+|${escapeRegex(replaceSpaceWith)}+$`, 'g'), '')
        .substring(0, 256);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get a specific segment from a slug or path.
 * @example getSegment("path/to/resource", "/", 2) // "to"
 * @example getSegment("a-b-c", "-", 3) // "c"
 */
export function getSegment(slug: string | null, separator: string = '/', segmentNumber: number = 1): string | null {
    if (!slug) return null;
    const segments = slug.split(separator);
    return segments.length > 0 ? (segments[segmentNumber - 1] ?? null) : null;
}

/**
 * Extract domain name from a URL.
 * @example getDomainName("https://www.example.com/path") // "example.com"
 * @example getDomainName("https://sub.example.com/path", false) // "sub.example.com"
 */
export function getDomainName(url: string, removeWww: boolean = true): string | null {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        let hostname = urlObj.hostname;
        if (removeWww && hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        return hostname;
    } catch (error) {
        console.error(`Invalid URL: ${url}`, error);
        return null;
    }
}

/**
 * Join multiple path segments into a single path.
 * @example joinPaths("api", "v1", "users") // "api/v1/users"
 * @example joinPaths("/api/", "/v1/", "/users/") // "/api/v1/users"
 */
export function joinPaths(...paths: string[]): string {
    const segments = paths.filter((path) => !!path); // ignore invalid
    if (segments.length === 0) return '';

    let finalPath = segments.join('/');
    // Replace multiple slashes with single slash, but preserve protocol slashes (://)
    finalPath = finalPath.replace(/([^:]\/)\/+/g, '$1').replace(/^\/+/, '/');
    if (finalPath !== '/') {
        finalPath = finalPath.replace(/\/+$/g, ''); // remove trailing slash if it's not just a single slash
    }
    return finalPath;
}

/**
 * Get the base URL from the current window location.
 * @example getBaseUrl() // "https://example.com" (in browser)
 * @example getBaseUrl() // "" (in server environment)
 */
export function getBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    return window.location?.origin ?? '';
}

/**
 * Prepend base URL to relative paths.
 * @example prependBaseUrlForRelativePath("/api/users", "https://api.example.com") // "https://api.example.com/api/users"
 * @example prependBaseUrlForRelativePath("https://other.com", "https://api.example.com") // "https://other.com" (unchanged)
 */
export function prependBaseUrlForRelativePath(url: string, baseUrl: string = process.env.BASE_URL || ''): string {
    if (!url) return url;
    // Check for absolute URLs (with protocol)
    if (url.includes('://') || url.startsWith('//')) {
        return url;
    }
    return joinPaths(baseUrl, url);
}

/**
 * Check if a string is a valid URL.
 * @example isValidUrl("https://example.com") // true
 * @example isValidUrl("not-a-url") // false
 */
export function isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Replace multiple consecutive slashes with single slash, except after colon.
 * @example replaceDoubleSlashes("https://example.com//path") // "https://example.com/path"
 * @example replaceDoubleSlashes("mailto:test@example.com") // "mailto:test@example.com" (unchanged)
 */
export function replaceDoubleSlashes(url: string): string {
    if (!url) return url;
    return url.replace(/([^:]\/)\/+/g, '$1'); // replace multiple slashes with single slash, except after colon
}

/**
 * Get a specific search parameter from a URL.
 * @example getSearchParam("error") // gets "error" param from current URL
 * @example getSearchParam("error", "default") // with default value
 * @example getSearchParam("error", "default", "https://example.com?error=value") // from custom URL
 *
 * @param paramName - The name of the search parameter to get
 * @param defaultValue - Optional default value to return if parameter not found
 * @param url - Optional URL string. If not provided, uses current window location
 * @returns The parameter value, or defaultValue (or null) if not found
 */
export function getSearchParam(paramName: string, defaultValue?: string, url?: string): string | null {
    if (!paramName) return defaultValue ?? null;

    // Use provided URL or current window location
    const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

    if (!targetUrl) return defaultValue ?? null;

    try {
        // Try using URL constructor first (more reliable)
        const urlObj = new URL(targetUrl);
        return urlObj.searchParams.get(paramName) ?? defaultValue ?? null;
    } catch {
        // Fallback to manual parsing if URL constructor fails
        const searchString = extractSearchString(targetUrl);
        if (!searchString) return defaultValue ?? null;

        const params = parseSearchString(searchString);
        return params[paramName] ?? defaultValue ?? null;
    }
}

/**
 * Extract search string from URL manually (fallback method)
 */
function extractSearchString(url: string): string {
    const questionMarkIndex = url.indexOf('?');
    return questionMarkIndex !== -1 ? url.substring(questionMarkIndex) : '';
}

/**
 * Parse search string into key-value pairs
 */
function parseSearchString(searchString: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (!searchString.startsWith('?')) return params;

    const paramsString = searchString.substring(1);
    const pairs = paramsString.split('&');

    for (const pair of pairs) {
        if (!pair) continue;

        const [key, value] = pair.split('=');
        if (key) {
            const decodedKey = decodeURIComponent(key);
            const decodedValue = value ? decodeURIComponent(value) : '';
            params[decodedKey] = decodedValue;
        }
    }

    return params;
}
