import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createScheduler } from '@ottabase/cf-scheduler/server';

export const runtime = 'edge';

// POST /api/scheduler/init - Initialize scheduler database schema
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const scheduler = createScheduler(env.DB);
    await scheduler.initializeSchema();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scheduler init error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize scheduler',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
