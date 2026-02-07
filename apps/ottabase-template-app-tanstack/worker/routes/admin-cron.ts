import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import { initAdminCron } from '../lib/db-utils';
import { AuditLog, ScheduledTask } from '@ottabase/ottaorm/models';
import type { CloudflareEnv } from '../../cloudflare-env';

async function getSessionUser(request: Request, env: CloudflareEnv) {
    const session = await getSession(request, env as any, getAuthOptions(env));
    return {
        userId: session?.user?.id ?? undefined,
        userEmail: (session?.user as any)?.email ?? undefined,
        organizationId: request.headers.get('x-organization-id') || session?.user?.organizationId || undefined,
    };
}

export interface AdminCronContext {
    request: Request;
    env: CloudflareEnv;
}

export async function handleAdminCronList(context: AdminCronContext): Promise<Response> {
    const { env } = context;
    const initErr = initAdminCron(env);
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

export async function handleAdminCronCreate(context: AdminCronContext): Promise<Response> {
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

        const { userId, userEmail, organizationId } = await getSessionUser(request, env);
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'create',
            resourceType: 'scheduled_task',
            resourceId: newTask.get('id') as string,
            changes: { name: body.name, schedule: body.schedule, task: body.task },
        }).catch(() => {});

        return jsonResponse(newTask.toJson(), 201);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create task', 400, {
            code: 'VALIDATION_ERROR',
        });
    }
}

export async function handleCronTask(
    context: AdminCronContext,
    taskId: string,
    action: 'toggle' | 'run' | null,
): Promise<Response | null> {
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
        const wasBefore = task.get('isActive');
        await task.toggle();

        const { userId, userEmail, organizationId } = await getSessionUser(request, env);
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'update',
            resourceType: 'scheduled_task',
            resourceId: cleanId,
            changes: { before: { isActive: wasBefore }, after: { isActive: task.get('isActive') } },
            metadata: { name: task.get('name'), action: 'toggle' },
        }).catch(() => {});

        return jsonResponse({ success: true, task: task.toJson() });
    }

    if (action === 'run' && request.method === 'POST') {
        await task.markRunning();

        const { userId, userEmail, organizationId } = await getSessionUser(request, env);
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'execute',
            resourceType: 'scheduled_task',
            resourceId: cleanId,
            metadata: { name: task.get('name'), action: 'manual_run' },
        }).catch(() => {});

        return jsonResponse({
            success: true,
            message: 'Task execution started',
            task: task.toJson(),
        });
    }

    if (!action && request.method === 'DELETE') {
        const taskName = task.get('name') as string;
        await ScheduledTask.delete(cleanId);

        const { userId, userEmail, organizationId } = await getSessionUser(request, env);
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'delete',
            resourceType: 'scheduled_task',
            resourceId: cleanId,
            metadata: { name: taskName },
        }).catch(() => {});

        return jsonResponse({ success: true, message: 'Task deleted' });
    }

    return null;
}
