import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';
import type { CreateTaskInput } from '@ottabase/cf-scheduler';

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

// GET /api/scheduler/tasks - List all tasks
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const scheduler = createScheduler(env.DB, { handlers: demoHandlers });

    const url = new URL(request.url);
    const appId = url.searchParams.get('app_id') || undefined;

    const tasks = await scheduler.getTasks(appId);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Scheduler GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/scheduler/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as CreateTaskInput;

    const scheduler = createScheduler(env.DB, { handlers: demoHandlers });
    const task = await scheduler.createTask(body);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Scheduler POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
