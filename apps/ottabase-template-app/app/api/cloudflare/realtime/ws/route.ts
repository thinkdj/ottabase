import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest } from 'next/server';

// TODO: Re-enable edge runtime after fixing Cloudflare Workers module bundling
// export const runtime = 'edge';

/**
 * WebSocket endpoint for realtime connections
 * GET /api/cloudflare/realtime/ws?clientId=xxx
 */
export async function GET(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_REALTIME) {
            return new Response(
                JSON.stringify({
                    error: 'Realtime is not available in this environment',
                    details: 'The Durable Object binding (OBCF_REALTIME) is not configured for local development.',
                    hint: 'Deploy with `wrangler deploy --env production` to enable Durable Objects, or run the Durable Object in a separate Worker for local development.',
                    environment: env.ENVIRONMENT ?? 'unknown',
                }),
                {
                    status: 501,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        // Check if this is a WebSocket upgrade request
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
            return new Response(JSON.stringify({ error: 'Expected WebSocket upgrade' }), {
                status: 426,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get or create the global RealtimeActor instance
        const id = env.OBCF_REALTIME.idFromName('global');
        const stub = env.OBCF_REALTIME.get(id);

        // Forward the WebSocket upgrade request to the Durable Object
        // The RealtimeActor will handle the WebSocket protocol
        return stub.fetch(request as any) as unknown as Response;
    } catch (error) {
        console.error('Realtime WebSocket error:', error);
        return new Response(
            JSON.stringify({
                error: 'Failed to establish WebSocket connection',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}
