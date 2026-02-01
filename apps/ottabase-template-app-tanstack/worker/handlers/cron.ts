/**
 * Admin cron/scheduled tasks management API
 */

import { ScheduledTask } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { initAdminCron } from '../utils/db';
import { readJson } from '../utils/request';

export async function handleCronList(env: CloudflareEnv): Promise<Response> {
    const initErr = initAdminCron(env);
    if (initErr) return initErr;

    // Get all tasks
    const tasks = await ScheduledTask.all();

    // Calculate stats
    const activeCount = tasks.filter((t) => t.get('isActive')).length;
    const totalRuns = tasks.reduce((sum, t) => sum + ((t.get('runCount') as number) || 0), 0);
    const totalFails = tasks.reduce((sum, t) => sum + ((t.get('failCount') as number) || 0), 0);

    // Get registered handlers (mock for now, would come from registry)
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

export async function handleCronCreate(request: Request, env: CloudflareEnv): Promise<Response> {
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

export async function handleCronTaskOperations(
    request: Request,
    env: CloudflareEnv,
    taskId: string,
): Promise<Response> {
    const initErr = initAdminCron(env);
    if (initErr) return initErr;

    const isToggle = taskId.endsWith('/toggle');
    const isRun = taskId.endsWith('/run');

    // Clean ID if it has action suffix
    const cleanId = isToggle ? taskId.replace('/toggle', '') : isRun ? taskId.replace('/run', '') : taskId;

    const task = await ScheduledTask.find(cleanId);

    if (!task) {
        return errorResponse('Task not found', 404);
    }

    // Toggle active status
    if (isToggle && request.method === 'POST') {
        await task.toggle();
        return jsonResponse({ success: true, task: task.toJson() });
    }

    // Run task manually
    if (isRun && request.method === 'POST') {
        await task.markRunning();
        // In a real implementation, this would dispatch the task immediately
        // For now, we'll just acknowledge the request
        return jsonResponse({
            success: true,
            message: 'Task execution started',
            task: task.toJson(),
        });
    }

    // Delete task
    if (request.method === 'DELETE' && !isToggle && !isRun) {
        await ScheduledTask.delete(cleanId);
        return jsonResponse({ success: true, message: 'Task deleted' });
    }

    return errorResponse('Invalid operation', 400);
}
