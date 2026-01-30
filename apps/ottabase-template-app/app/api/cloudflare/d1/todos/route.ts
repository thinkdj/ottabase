import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Todo } from '../../../../../ottabase/models/Todo';

export const runtime = 'edge';

// GET /api/cloudflare/d1/todos - List all todos (using OttaORM/Drizzle)
export async function GET(_request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database binding not configured' }, { status: 500 });
        }

        // ✅ Use OttaORM with Drizzle (type-safe queries)
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Eloquent-like syntax with OttaORM
        const todos = await Todo.all({
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });

        return NextResponse.json({
            todos: todos.map((t) => t.toJson()),
        });
    } catch (error) {
        console.error('D1 GET error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch todos',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

// POST /api/cloudflare/d1/todos - Create a new todo (using OttaORM/Drizzle)
export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database binding not configured' }, { status: 500 });
        }

        const body = await request.json();
        const { title } = body;

        if (!title || typeof title !== 'string') {
            return NextResponse.json({ error: 'Title is required and must be a string' }, { status: 400 });
        }

        // ✅ Use OttaORM with Drizzle (type-safe operations)
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Eloquent-like syntax with OttaORM
        const todo = await Todo.create({
            id: crypto.randomUUID(),
            title: title.trim(),
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            message: 'Todo created successfully',
            todo: todo.toJson(),
        });
    } catch (error) {
        console.error('D1 POST error:', error);
        return NextResponse.json(
            {
                error: 'Failed to create todo',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
