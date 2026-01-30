import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { NextRequest, NextResponse } from 'next/server';
import { Todo } from '../../../../../../ottabase/models/Todo';

export const runtime = 'edge';

// PATCH /api/cloudflare/d1/todos/[id] - Update a todo (using OttaORM/Drizzle)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database binding not configured' }, { status: 500 });
        }

        const { id } = await params;

        const body = await request.json();
        const { completed } = body;

        if (typeof completed !== 'boolean') {
            return NextResponse.json({ error: 'Completed must be a boolean' }, { status: 400 });
        }

        // ✅ Use OttaORM with Drizzle (type-safe updates)
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Find the todo by ID
        const todo = await Todo.find(id);

        if (!todo) {
            return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
        }

        // Update using OttaORM
        todo.set('completed', completed);
        await todo.save();

        return NextResponse.json({
            success: true,
            message: 'Todo updated successfully',
            todo: todo.toJson(),
        });
    } catch (error) {
        console.error('D1 PATCH error:', error);
        return NextResponse.json(
            {
                error: 'Failed to update todo',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

// DELETE /api/cloudflare/d1/todos/[id] - Delete a todo (using OttaORM/Drizzle)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database binding not configured' }, { status: 500 });
        }

        const { id } = await params;

        // ✅ Use OttaORM with Drizzle (type-safe deletes)
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Find the todo by ID
        const todo = await Todo.find(id);

        if (!todo) {
            return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
        }

        // Delete using OttaORM
        await todo.destroy();

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
            { status: 500 },
        );
    }
}
