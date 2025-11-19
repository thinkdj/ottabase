import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';
import type { UpdateTaskInput } from '@ottabase/cf-scheduler';
import { schedulerHandlers } from '@/lib/scheduler-handlers';

export const runtime = 'edge';

// GET /api/scheduler/tasks/[id] - Get a single task
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

    const scheduler = createScheduler(env.DB, { handlers: schedulerHandlers });
    const task = await scheduler.getTask(id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Scheduler GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/scheduler/tasks/[id] - Update a task
export async function PATCH(
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

    const body = (await request.json()) as UpdateTaskInput;

    const scheduler = createScheduler(env.DB, { handlers: schedulerHandlers });
    const task = await scheduler.updateTask(id, body);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Scheduler PATCH error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/scheduler/tasks/[id] - Delete a task
export async function DELETE(
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
    const success = await scheduler.deleteTask(id);

    if (!success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scheduler DELETE error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
