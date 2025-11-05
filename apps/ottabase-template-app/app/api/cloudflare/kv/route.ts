import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createKVClient } from '@ottabase/cf/kv';

export const runtime = 'edge';

// GET /api/cloudflare/kv?key=xxx - Get value by key
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.MY_KV) {
      return NextResponse.json(
        { error: 'KV namespace binding not configured' },
        { status: 500 }
      );
    }

    const key = request.nextUrl.searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const kv = createKVClient({ namespace: env.MY_KV });
    const result = await kv.getText(key);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to get value', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ value: result.data });
  } catch (error) {
    console.error('KV GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get value',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/cloudflare/kv - Set value
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.MY_KV) {
      return NextResponse.json(
        { error: 'KV namespace binding not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { key, value, ttl } = body;

    if (!key || !value) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    const kv = createKVClient({ namespace: env.MY_KV });
    const result = await kv.put(key, value, {
      expirationTtl: ttl ? parseInt(ttl) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to set value', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('KV POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to set value',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/cloudflare/kv?key=xxx - Delete value
export async function DELETE(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.MY_KV) {
      return NextResponse.json(
        { error: 'KV namespace binding not configured' },
        { status: 500 }
      );
    }

    const key = request.nextUrl.searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const kv = createKVClient({ namespace: env.MY_KV });
    const result = await kv.delete(key);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to delete value', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('KV DELETE error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete value',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
