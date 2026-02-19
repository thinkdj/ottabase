/**
 * Helper to create a standardized JSON response.
 * Uses strict content-type header and allows type-safe data.
 */
export function jsonResponse<T>(data: T, status: number = 200, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(data), {
        ...init,
        status,
        headers: {
            ...init.headers,
            'Content-Type': 'application/json',
        },
    });
}
