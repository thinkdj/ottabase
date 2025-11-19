import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';
import { schedulerHandlers } from '@/lib/scheduler-handlers';

export const runtime = 'edge';

// POST /api/scheduler/tasks/[id]/trigger - Manually trigger a task
export async function POST(
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

    const scheduler = createScheduler(env.DB, { handlers: schedulerHandlers });
    const result = await scheduler.triggerTask(id);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Scheduler trigger error:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
