import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';
import type { CreateTaskInput } from '@ottabase/cf-scheduler';
import { schedulerHandlers } from '@/lib/scheduler-handlers';

export const runtime = 'edge';

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

    const scheduler = createScheduler(env.DB, { handlers: schedulerHandlers });

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

    // Default to 'default' app if not provided
    if (!body.app_id) {
      body.app_id = 'default';
    }

    const scheduler = createScheduler(env.DB, { handlers: schedulerHandlers });
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
