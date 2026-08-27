import { ValidationError } from '@ottabase/ottaorm';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { parsePaginationParams } from '@ottabase/utils/pagination';
import { requireAdminAccess } from '../lib/admin-guard';
import { initAdminCron } from '../lib/db-utils';
import { readJson } from '../lib/utils';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getRegisteredAppCronHandlers, runAppCronTask } from '../../ottabase/cron';
import type { ApiRouteContext } from './router';

export async function handleAdminCronList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const initErr = initAdminCron(context.env);
    if (initErr) return initErr;

    const { page, perPage } = parsePaginationParams(context.url.searchParams, {
        defaults: { page: 1, perPage: 50, orderBy: 'createdAt' },
    });
    const appId = getOttabaseConfig(context.env).appId;
    const paged = await ScheduledTask.paginate(
        page,
        Math.min(perPage, 100),
        { appId },
        { orderBy: 'createdAt', orderDirection: 'desc' },
    );
    const activeCount = await ScheduledTask.count({ appId, isActive: true });
    const totals = await ScheduledTask.sums(['runCount', 'failCount'], { appId });

    const registeredHandlers = getRegisteredAppCronHandlers();

    return jsonResponse({
        tasks: paged.data.map((t) => t.toJson()),
        pagination: {
            page: paged.page,
            perPage: paged.perPage,
            total: paged.total,
            totalPages: paged.totalPages,
            hasNextPage: paged.hasNextPage,
            hasPrevPage: paged.hasPrevPage,
        },
        registeredHandlers,
        stats: {
            total: paged.total,
            active: activeCount,
            totalRuns: totals.runCount ?? 0,
            totalFails: totals.failCount ?? 0,
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

    try {
        const registeredHandlers = getRegisteredAppCronHandlers();
        const appId = getOttabaseConfig(env).appId;
        const newTask = await ScheduledTask.createRegistered(
            {
                name: body.name,
                description: body.description,
                schedule: body.schedule,
                taskType: body.taskType || 'handler',
                task: body.task,
                payload: body.payload || null,
                isActive: body.isActive ?? true,
                appId,
            },
            registeredHandlers.map((handler) => handler.name),
        );

        return jsonResponse(newTask.toJson(), 201);
    } catch (error) {
        if (error instanceof ValidationError) {
            return errorResponse('Scheduled task validation failed', 422, {
                code: 'VALIDATION_ERROR',
                fieldErrors: Object.fromEntries(
                    Object.entries(error.fieldErrors).map(([field, message]) => [field, [message]]),
                ),
            });
        }

        console.error(
            JSON.stringify({
                event: 'admin_cron_create_failed',
                error: redactErrorForLog(error),
            }),
        );
        return errorResponse('Failed to create scheduled task', 500, {
            code: 'CRON_CREATE_FAILED',
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
    const appId = getOttabaseConfig(env).appId;

    if (action === 'run' && request.method === 'POST') {
        const execution = await runAppCronTask(env, cleanId);
        if (execution.status === 'not_found') {
            return errorResponse('Task not found', 404);
        }
        if (execution.status === 'locked' || execution.status === 'superseded') {
            return errorResponse('Task is already running', 409, {
                code: 'CRON_TASK_RUNNING',
            });
        }
        if (execution.status === 'failed') {
            console.error(
                JSON.stringify({
                    event: 'admin_cron_manual_run_failed',
                    taskId: cleanId,
                    error: redactErrorForLog(execution.error),
                }),
            );
            return errorResponse('Scheduled task execution failed', 500, {
                code: 'CRON_TASK_FAILED',
            });
        }

        const updatedTask = await ScheduledTask.findForApp(cleanId, appId);
        return jsonResponse({
            success: true,
            message: 'Task executed successfully',
            task: updatedTask?.toJson() ?? null,
        });
    }

    const task = await ScheduledTask.findForApp(cleanId, appId);

    if (!task) {
        return errorResponse('Task not found', 404);
    }

    if (action === 'toggle' && request.method === 'POST') {
        await task.toggle();
        return jsonResponse({ success: true, task: task.toJson() });
    }

    if (!action && request.method === 'DELETE') {
        await ScheduledTask.deleteConstrained(cleanId, { where: { appId } });
        return jsonResponse({ success: true, message: 'Task deleted' });
    }

    return null;
}
