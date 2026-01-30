/**
 * Example Cloudflare Worker using cf-realtime
 *
 * This demonstrates how to set up a complete realtime server
 * with WebSocket support and REST API for broadcasting.
 */

import { RealtimeActor, RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
import { handler } from '@cloudflare/actors';

// Export the Actor class for Durable Objects
export { RealtimeActor };

// Export the default handler
export default handler(RealtimeActor);

/**
 * Environment bindings
 */
export interface Env {
    REALTIME: DurableObjectNamespace;
    // Add other bindings like KV, R2, etc. as needed
}

/**
 * Main Worker handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }

        try {
            // WebSocket connection endpoint
            if (url.pathname === '/realtime' && request.headers.get('Upgrade') === 'websocket') {
                return handleWebSocket(request, env);
            }

            // REST API: Broadcast to channels
            if (url.pathname === '/api/broadcast' && request.method === 'POST') {
                return handleBroadcast(request, env);
            }

            // REST API: Get stats
            if (url.pathname === '/api/stats' && request.method === 'GET') {
                return handleStats(env);
            }

            // REST API: Health check
            if (url.pathname === '/api/health' && request.method === 'GET') {
                return handleHealth(env);
            }

            // Example: Send a message to a specific user
            if (url.pathname.startsWith('/api/notify/') && request.method === 'POST') {
                const userId = url.pathname.split('/').pop();
                return handleNotifyUser(userId!, request, env);
            }

            return new Response('Not Found', { status: 404 });
        } catch (error) {
            console.error('Worker error:', error);
            return new Response(
                JSON.stringify({
                    error: error instanceof Error ? error.message : 'Internal Server Error',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }
    },
};

/**
 * Handle WebSocket connection
 */
async function handleWebSocket(request: Request, env: Env): Promise<Response> {
    // Get or create the global Actor instance
    const id = env.OBCF_REALTIME.idFromName('global');
    const stub = env.OBCF_REALTIME.get(id);

    // Forward the request to the Actor
    return stub.fetch(request);
}

/**
 * Handle broadcast request
 */
async function handleBroadcast(request: Request, env: Env): Promise<Response> {
    try {
        const body = (await request.json()) as {
            channels: string[];
            event: string;
            data: any;
            persistForOffline?: boolean;
            metadata?: Record<string, any>;
        };

        // Validate input
        if (!body.channels || !Array.isArray(body.channels) || body.channels.length === 0) {
            return new Response(JSON.stringify({ error: 'channels array is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!body.event) {
            return new Response(JSON.stringify({ error: 'event is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);

        const result = await broadcaster.broadcast({
            channels: body.channels,
            event: body.event,
            data: body.data,
            persistForOffline: body.persistForOffline || false,
            metadata: body.metadata,
        });

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                ...getCORSHeaders(),
            },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Invalid request',
            }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * Handle stats request
 */
async function handleStats(env: Env): Response {
    const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
    const stats = await broadcaster.getStats();

    return new Response(JSON.stringify(stats), {
        headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(),
        },
    });
}

/**
 * Handle health check
 */
async function handleHealth(env: Env): Response {
    const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
    const health = await broadcaster.health();

    return new Response(JSON.stringify(health), {
        headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(),
        },
    });
}

/**
 * Handle notify specific user
 */
async function handleNotifyUser(userId: string, request: Request, env: Env): Response {
    try {
        const body = (await request.json()) as {
            event: string;
            data: any;
            persistForOffline?: boolean;
        };

        const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);

        const result = await broadcaster.send(`user:${userId}`, body.event, body.data, {
            persistForOffline: body.persistForOffline ?? true,
            metadata: {
                userId,
                timestamp: Date.now(),
            },
        });

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                ...getCORSHeaders(),
            },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Invalid request',
            }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * Handle CORS preflight
 */
function handleCORS(): Response {
    return new Response(null, {
        status: 204,
        headers: getCORSHeaders(),
    });
}

/**
 * Get CORS headers
 */
function getCORSHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}
