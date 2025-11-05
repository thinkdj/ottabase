import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

export const runtime = 'edge';

/**
 * Broadcast message to channels
 * POST /api/cloudflare/realtime/broadcast
 * Body: { channels: string[], event: string, data: any, persistForOffline?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.REALTIME) {
      return NextResponse.json(
        { error: 'Realtime Durable Object binding not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { channels, event, data, persistForOffline = false } = body;

    // Validate input
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: 'channels array is required' },
        { status: 400 }
      );
    }

    if (!event) {
      return NextResponse.json(
        { error: 'event is required' },
        { status: 400 }
      );
    }

    // Create broadcaster and send message
    const broadcaster = new RealtimeBroadcaster(env.REALTIME);

    const result = await broadcaster.broadcast({
      channels,
      event,
      data,
      persistForOffline,
      metadata: {
        sentAt: Date.now(),
        source: 'api',
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to broadcast message', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      channelsCount: channels.length,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      {
        error: 'Failed to broadcast message',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
