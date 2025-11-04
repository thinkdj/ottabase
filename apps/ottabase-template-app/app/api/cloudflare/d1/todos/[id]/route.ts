import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export const runtime = 'edge';

// PATCH /api/cloudflare/d1/todos/[id] - Update a todo
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { completed } = body;

    if (typeof completed !== 'boolean') {
      return NextResponse.json(
        { error: 'Completed must be a boolean' },
        { status: 400 }
      );
    }

    const db = createD1Client({ database: env.DB });

    const result = await db.execute(
      'UPDATE todos SET completed = ? WHERE id = ?',
      [completed ? 1 : 0, id]
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to update todo', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Todo updated successfully',
    });
  } catch (error) {
    console.error('D1 PATCH error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update todo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/cloudflare/d1/todos/[id] - Delete a todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const db = createD1Client({ database: env.DB });

    const result = await db.execute('DELETE FROM todos WHERE id = ?', [id]);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to delete todo', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Todo deleted successfully',
    });
  } catch (error) {
    console.error('D1 DELETE error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete todo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
