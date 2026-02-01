/**
 * Health check endpoint handler
 */

export function handleHealthCheck(): Response {
    return Response.json({
        ok: true,
        name: 'ottabase-template-app-tanstack',
        timestamp: Date.now(),
    });
}
