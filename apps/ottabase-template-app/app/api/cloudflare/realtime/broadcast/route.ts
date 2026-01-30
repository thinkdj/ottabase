import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
// import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

// TODO: Re-enable edge runtime after fixing Cloudflare Workers module bundling
// export const runtime = 'edge';

/**
 * Broadcast message to channels
 * POST /api/cloudflare/realtime/broadcast
 * Body: { channels: string[], event: string, data: any, persistForOffline?: boolean }
 */
export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_REALTIME) {
            return NextResponse.json(
                {
                    error: 'Realtime is not available in this environment',
                    details: 'The Durable Object binding (OBCF_REALTIME) is not configured for local development.',
                    hint: 'Deploy with `wrangler deploy --env production` to enable Durable Objects, or run the Durable Object in a separate Worker for local development.',
                    environment: env.ENVIRONMENT ?? 'unknown',
                },
                { status: 501 },
            );
        }

        const body = await request.json();
        const { channels, event, data, persistForOffline = false } = body;

        // Validate input
        if (!channels || !Array.isArray(channels) || channels.length === 0) {
            return NextResponse.json({ error: 'channels array is required' }, { status: 400 });
        }

        if (!event) {
            return NextResponse.json({ error: 'event is required' }, { status: 400 });
        }

        // TODO: Re-enable after fixing bundling
        // const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
        // const result = await broadcaster.broadcast({
        //   channels,
        //   event,
        //   data,
        //   persistForOffline,
        //   metadata: {
        //     sentAt: Date.now(),
        //     source: 'api',
        //   },
        // });
        // if (!result.success) {
        //   return NextResponse.json(
        //     { error: 'Failed to broadcast message', details: result.error },
        //     { status: 500 }
        //   );
        // }

        return NextResponse.json({
            success: true,
            channelsCount: channels.length,
            note: 'Realtime broadcasting temporarily disabled during build fixes',
        });
    } catch (error) {
        console.error('Broadcast error:', error);
        return NextResponse.json(
            {
                error: 'Failed to broadcast message',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
