import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured. Check wrangler.jsonc' },
        { status: 500 }
      );
    }

    const db = createD1Client({ database: env.DB });

    // Create todos table if not exists
    const createTableResult = await db.execute(
      `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    if (!createTableResult.success) {
      return NextResponse.json(
        { error: 'Failed to create table', details: createTableResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error) {
    console.error('D1 initialization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
