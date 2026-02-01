/**
 * Request utility functions for parsing and validating HTTP requests
 */

export function isHtmlRequest(request: Request): boolean {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // If the path has a file extension, it's not an HTML request
    if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
        return false;
    }

    // For routes without extensions, check the Accept header as fallback
    const accept = request.headers.get('Accept');
    return !!accept && accept.includes('text/html');
}

export async function readJson<T = any>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        // @ts-expect-error - ok
        return {};
    }
}
