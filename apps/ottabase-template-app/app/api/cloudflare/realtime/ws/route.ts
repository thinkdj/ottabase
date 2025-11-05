import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

/**
 * WebSocket endpoint for realtime connections
 * GET /api/cloudflare/realtime/ws?clientId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.REALTIME) {
      return new Response(
        JSON.stringify({ error: 'Realtime Durable Object binding not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response(
        JSON.stringify({ error: 'Expected WebSocket upgrade' }),
        {
          status: 426,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get or create the global RealtimeActor instance
    const id = env.REALTIME.idFromName('global');
    const stub = env.REALTIME.get(id);

    // Forward the WebSocket upgrade request to the Durable Object
    // The RealtimeActor will handle the WebSocket protocol
    return stub.fetch(request);
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
      }
    );
  }
}
