import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { Todo } from '../../ottabase/models/Todo';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface D1RouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleD1Init(context: D1RouteContext): Promise<Response> {
    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured. Check wrangler.jsonc', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    await env.OBCF_D1.batch([
        env.OBCF_D1.prepare(`
          CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            user_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `),
    ]);

    registerConnection('default', createD1Driver(env.OBCF_D1));
    const count = (await Todo.all()).length;

    return jsonResponse({
        success: true,
        message: 'Database initialized successfully',
        info: `Found ${count} existing todos`,
    });
}

export async function handleD1Todos(context: D1RouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    if (request.method === 'GET') {
        const todos = await Todo.all({
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });
        return jsonResponse({ todos: todos.map((t) => t.toJson()) });
    }

    if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const title = (body as any).title;
        if (!title || typeof title !== 'string') {
            return errorResponse('Title is required and must be a string', 400);
        }

        const todo = await Todo.create({
            id: crypto.randomUUID(),
            title: title.trim(),
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        return jsonResponse({
            success: true,
            message: 'Todo created successfully',
            todo: todo.toJson(),
        });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}

export async function handleD1TodoById(
    context: D1RouteContext,
    id: string,
    method: 'PATCH' | 'DELETE',
): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    if (method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        const completed = (body as any).completed;
        if (typeof completed !== 'boolean') {
            return errorResponse('Completed must be a boolean', 400);
        }

        const todo = await Todo.find(id);
        if (!todo) {
            return errorResponse('Todo not found', 404);
        }

        todo.set('completed', completed);
        await todo.save();

        return jsonResponse({
            success: true,
            message: 'Todo updated successfully',
            todo: todo.toJson(),
        });
    }

    const todo = await Todo.find(id);
    if (!todo) {
        return errorResponse('Todo not found', 404);
    }

    await Todo.delete(id);
    return jsonResponse({
        success: true,
        message: 'Todo deleted successfully',
    });
}
