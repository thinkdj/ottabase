import { ScheduledTask } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import { initAdminCron } from '../lib/db-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

export async function handleAdminCronList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const initErr = initAdminCron(context.env);
    if (initErr) return initErr;

    const tasks = await ScheduledTask.all();
    const activeCount = tasks.filter((t) => t.get('isActive')).length;
    const totalRuns = tasks.reduce((sum, t) => sum + ((t.get('runCount') as number) || 0), 0);
    const totalFails = tasks.reduce((sum, t) => sum + ((t.get('failCount') as number) || 0), 0);

    const registeredHandlers = [
        'cleanup:sessions',
        'cleanup:temp-files',
        'email:send-queue',
        'backup:database',
        'analytics:aggregate',
    ];

    return jsonResponse({
        tasks: tasks.map((t) => t.toJson()),
        registeredHandlers,
        stats: {
            total: tasks.length,
            active: activeCount,
            totalRuns,
            totalFails,
        },
    });
}

export async function handleAdminCronCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env } = context;
    const initErr = initAdminCron(env);
    if (initErr) return initErr;

    const body = await readJson<{
        name?: string;
        description?: string;
        schedule?: string;
        taskType?: string;
        task?: string;
        payload?: string;
        isActive?: boolean;
    }>(request);

    if (!body.name || !body.schedule || !body.task) {
        return errorResponse('name, schedule, and task are required', 400, {
            code: 'VALIDATION_ERROR',
        });
    }

    try {
        const newTask = await ScheduledTask.create({
            name: body.name,
            description: body.description,
            schedule: body.schedule,
            taskType: body.taskType || 'handler',
            task: body.task,
            payload: body.payload || null,
            isActive: body.isActive ?? true,
        });

        return jsonResponse(newTask.toJson(), 201);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create task', 400, {
            code: 'VALIDATION_ERROR',
        });
    }
}

export async function handleCronTask(
    context: ApiRouteContext,
    taskId: string,
    action: 'toggle' | 'run' | null,
): Promise<Response | null> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, request } = context;
    const initErr = initAdminCron(env);
    if (initErr) return initErr;

    const cleanId =
        action === 'toggle' ? taskId.replace('/toggle', '') : action === 'run' ? taskId.replace('/run', '') : taskId;
    const task = await ScheduledTask.find(cleanId);

    if (!task) {
        return errorResponse('Task not found', 404);
    }

    if (action === 'toggle' && request.method === 'POST') {
        await task.toggle();
        return jsonResponse({ success: true, task: task.toJson() });
    }

    if (action === 'run' && request.method === 'POST') {
        await task.markRunning();
        return jsonResponse({
            success: true,
            message: 'Task execution started',
            task: task.toJson(),
        });
    }

    if (!action && request.method === 'DELETE') {
        await ScheduledTask.delete(cleanId);
        return jsonResponse({ success: true, message: 'Task deleted' });
    }

    return null;
}
