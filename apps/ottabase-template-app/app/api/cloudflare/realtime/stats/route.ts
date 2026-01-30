import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
// import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

// TODO: Re-enable edge runtime after fixing Cloudflare Workers module bundling
// export const runtime = 'edge';

/**
 * Get realtime stats
 * GET /api/cloudflare/realtime/stats
 */
export async function GET(_request: NextRequest) {
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

        // TODO: Re-enable after fixing bundling
        // const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
        // const stats = await broadcaster.getStats();

        return NextResponse.json({
            totalConnections: 0,
            channels: [],
            offlineMessagesQueued: 0,
        });
    } catch (error) {
        console.error('Stats error:', error);
        return NextResponse.json(
            {
                error: 'Failed to get stats',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
