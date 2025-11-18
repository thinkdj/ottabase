import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';

export const runtime = 'edge';

// Demo task handlers
const demoHandlers = {
  'demo-task': async (payload?: unknown) => {
    console.log('Demo task executed with payload:', payload);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      success: true,
      output: { message: 'Demo task completed', payload },
    };
  },
  'send-notifications': async (payload?: unknown) => {
    console.log('Sending notifications:', payload);
    return {
      success: true,
      output: { sent: 5, payload },
    };
  },
  'cleanup-task': async () => {
    console.log('Running cleanup task');
    return {
      success: true,
      output: { cleaned: 10 },
    };
  },
};

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

    const scheduler = createScheduler(env.DB, { handlers: demoHandlers });
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
