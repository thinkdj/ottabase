import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

export const runtime = 'edge';

/**
 * Get realtime stats
 * GET /api/cloudflare/realtime/stats
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.REALTIME) {
      return NextResponse.json(
        { error: 'Realtime Durable Object binding not configured' },
        { status: 500 }
      );
    }

    const broadcaster = new RealtimeBroadcaster(env.REALTIME);
    const stats = await broadcaster.getStats();

    return NextResponse.json(stats || {
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
      { status: 500 }
    );
  }
}
