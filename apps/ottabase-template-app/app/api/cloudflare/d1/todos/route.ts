import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export const runtime = 'edge';

interface Todo {
  id: number;
  title: string;
  completed: number;
  created_at: string;
}

// GET /api/cloudflare/d1/todos - List all todos
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const db = createD1Client({ database: env.DB });

    const result = await db.query<Todo>(
      'SELECT * FROM todos ORDER BY created_at DESC'
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to fetch todos', details: result.error.message },
        { status: 500 }
      );
    }

    // Convert completed from INTEGER to boolean
    const todos = result.data.map((todo) => ({
      ...todo,
      completed: todo.completed === 1,
    }));

    return NextResponse.json({ todos });
  } catch (error) {
    console.error('D1 GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch todos',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/cloudflare/d1/todos - Create a new todo
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.DB) {
      return NextResponse.json(
        { error: 'D1 database binding not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }

    const db = createD1Client({ database: env.DB });

    const result = await db.execute(
      'INSERT INTO todos (title, completed) VALUES (?, 0)',
      [title.trim()]
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to create todo', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Todo created successfully',
    });
  } catch (error) {
    console.error('D1 POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create todo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
