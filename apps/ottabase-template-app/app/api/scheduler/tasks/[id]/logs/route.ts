import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';

export const runtime = 'edge';

// GET /api/scheduler/tasks/[id]/logs - Get task execution logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = await getCloudflareContext();
    const { id } = await params;

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const scheduler = createScheduler(env.DB);
    const logs = await scheduler.getTaskLogs(id, limit);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Scheduler logs error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
