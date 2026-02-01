/**
 * CORS middleware for handling cross-origin requests
 */

export function getCorsHeaders(origin: string): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        Vary: 'Origin',
    };
}

export function handlePreflight(request: Request): Response | null {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: getCorsHeaders(origin),
        });
    }

    return null;
}

export function applyCorsHeaders(response: Response, origin: string): Response {
    const headers = getCorsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}
