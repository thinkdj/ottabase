import {
    createScheduler,
    createTaskRepository,
    type SchedulerTickResult,
    type TaskExecutionResult,
    type TaskHandlerDefinitions,
} from '@ottabase/cron';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { dispatch } from '@ottabase/queue';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../config.loader';
import type {
    BatchTaskPayload,
    GenerateReportPayload,
    ProcessOrderPayload,
    SendEmailPayload,
    SyncDataPayload,
} from '../queue/handlers';
import { incrementDispatchStats } from '../queue';
import { resolvePlatformState } from '../../worker/bootstrap';
import { ensureDbConnection } from '../../worker/lib/db-utils';

export const APP_CRON_TICK = '* * * * *';

export interface AppCronPayloads {
    'queue:send-email': SendEmailPayload;
    'queue:process-order': ProcessOrderPayload;
    'queue:generate-report': GenerateReportPayload;
    'queue:sync-data': SyncDataPayload;
    'queue:batch-task': BatchTaskPayload;
}

export type AppCronHandlerName = keyof AppCronPayloads;

function payloadObject(payload: unknown, handler: AppCronHandlerName): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`Handler ${handler} requires a JSON object payload`);
    }
    return payload as Record<string, unknown>;
}

function requiredString(payload: Record<string, unknown>, field: string, handler: AppCronHandlerName): string {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Handler ${handler} requires payload.${field}`);
    }
    return value.trim();
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
    const value = payload[field];
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error(`payload.${field} must be a string`);
    return value;
}

function optionalObject(payload: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
    const value = payload[field];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`payload.${field} must be a JSON object`);
    }
    return value as Record<string, unknown>;
}

async function dispatchQueuedCronJob<T>(env: CloudflareEnv, type: string, payload: T): Promise<void> {
    const result = await dispatch(env.OBCF_QUEUE, type, payload);
    if (!result.success) throw result.error;
    try {
        await incrementDispatchStats(env, type);
    } catch (error) {
        // The queue accepted the job; an observability write must not turn that
        // successful side effect into a scheduler retry and duplicate dispatch.
        console.warn(
            JSON.stringify({
                event: 'cron_dispatch_stats_failed',
                jobType: type,
                error: redactErrorForLog(error),
            }),
        );
    }
}

export const appCronHandlerRegistry = {
    'queue:send-email': {
        description: 'Dispatch a scheduled email through the configured queue-backed mailer.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:send-email');
            const data: SendEmailPayload = {
                to: requiredString(input, 'to', 'queue:send-email'),
                subject: requiredString(input, 'subject', 'queue:send-email'),
                body: optionalString(input, 'body'),
                template: optionalString(input, 'template'),
                data: optionalObject(input, 'data'),
            };
            await dispatchQueuedCronJob(env, 'send-email', data);
        },
    },
    'queue:process-order': {
        description: 'Dispatch scheduled order processing to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:process-order');
            const orderId = input.orderId;
            if ((typeof orderId !== 'string' && typeof orderId !== 'number') || orderId === '') {
                throw new Error('Handler queue:process-order requires payload.orderId');
            }
            if (input.items !== undefined && !Array.isArray(input.items)) {
                throw new Error('payload.items must be an array');
            }
            const data: ProcessOrderPayload = {
                orderId,
                userId: optionalString(input, 'userId'),
                items: input.items as ProcessOrderPayload['items'],
            };
            await dispatchQueuedCronJob(env, 'process-order', data);
        },
    },
    'queue:generate-report': {
        description: 'Dispatch a scheduled report generation job to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:generate-report');
            const data: GenerateReportPayload = {
                reportType: requiredString(input, 'reportType', 'queue:generate-report'),
                userId: optionalString(input, 'userId'),
                params: optionalObject(input, 'params'),
            };
            await dispatchQueuedCronJob(env, 'generate-report', data);
        },
    },
    'queue:sync-data': {
        description: 'Dispatch a scheduled data synchronization job to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:sync-data');
            if (
                input.entityIds !== undefined &&
                (!Array.isArray(input.entityIds) || input.entityIds.some((id) => typeof id !== 'string'))
            ) {
                throw new Error('payload.entityIds must be an array of strings');
            }
            const data: SyncDataPayload = {
                source: requiredString(input, 'source', 'queue:sync-data'),
                target: requiredString(input, 'target', 'queue:sync-data'),
                entityType: optionalString(input, 'entityType'),
                entityIds: input.entityIds as string[] | undefined,
            };
            await dispatchQueuedCronJob(env, 'sync-data', data);
        },
    },
    'queue:batch-task': {
        description: 'Dispatch a general scheduled batch task to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:batch-task');
            if (input.taskNumber !== undefined && typeof input.taskNumber !== 'number') {
                throw new Error('payload.taskNumber must be a number');
            }
            const data: BatchTaskPayload = {
                userId: optionalString(input, 'userId'),
                taskNumber: input.taskNumber as number | undefined,
                action: optionalString(input, 'action'),
                data: input.data,
            };
            await dispatchQueuedCronJob(env, 'batch-task', data);
        },
    },
} satisfies TaskHandlerDefinitions<CloudflareEnv, AppCronPayloads>;

export const appCronScheduler = createScheduler<CloudflareEnv>({
    logger: {
        info: (message) => console.log(JSON.stringify({ event: 'cron_scheduler', level: 'info', message })),
        warn: (message) => console.warn(JSON.stringify({ event: 'cron_scheduler', level: 'warn', message })),
        error: (message) => console.error(JSON.stringify({ event: 'cron_scheduler', level: 'error', message })),
    },
}).registerHandlers<AppCronPayloads>(appCronHandlerRegistry);

export function getRegisteredAppCronHandlers(): Array<{ name: AppCronHandlerName; description: string }> {
    return appCronScheduler.getHandlers().map((handler) => ({
        name: handler.name as AppCronHandlerName,
        description: handler.description ?? '',
    }));
}

function appTaskRepository(env: CloudflareEnv) {
    const appId = getOttabaseConfig(env).appId;
    const scopedModel = {
        due: () => ScheduledTask.due(appId),
        find: (id: string) => ScheduledTask.findForApp(id, appId),
        acquireExecutionLock: (
            id: string,
            startedAt: Date,
            staleBefore: Date,
            scheduledOnly: boolean,
            driver: Parameters<typeof ScheduledTask.acquireExecutionLock>[5],
        ) => ScheduledTask.acquireExecutionLock(id, appId, startedAt, staleBefore, scheduledOnly, driver),
        completeExecution: (
            id: string,
            startedAt: Date,
            nextRunAt: Date,
            driver: Parameters<typeof ScheduledTask.completeExecution>[4],
        ) => ScheduledTask.completeExecution(id, appId, startedAt, nextRunAt, driver),
        failExecution: (
            id: string,
            startedAt: Date,
            error: string,
            nextRunAt: Date | null,
            driver: Parameters<typeof ScheduledTask.failExecution>[5],
        ) => ScheduledTask.failExecution(id, appId, startedAt, error, nextRunAt, driver),
    };
    return createTaskRepository(scopedModel, createD1Driver(env.OBCF_D1));
}

export async function runAppCronTick(env: CloudflareEnv): Promise<SchedulerTickResult> {
    return appCronScheduler.tick(env, appTaskRepository(env));
}

export async function runAppCronTask(env: CloudflareEnv, taskId: string): Promise<TaskExecutionResult> {
    return appCronScheduler.runTask(taskId, env, appTaskRepository(env));
}

/** Cloudflare's one-minute trigger delegates into the DB-driven scheduler. */
export async function handleAppScheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    _ctx: ExecutionContext,
): Promise<void> {
    if (controller.cron !== APP_CRON_TICK) {
        controller.noRetry();
        console.warn(
            JSON.stringify({
                event: 'cron_trigger_ignored',
                cron: controller.cron,
                scheduledTime: controller.scheduledTime,
            }),
        );
        return;
    }

    const platform = await resolvePlatformState(env);
    if (platform.state !== 'READY') {
        controller.noRetry();
        console.warn(
            JSON.stringify({
                event: 'cron_trigger_skipped',
                state: platform.state,
                scheduledTime: controller.scheduledTime,
            }),
        );
        return;
    }

    try {
        ensureDbConnection(env);
        const result = await runAppCronTick(env);
        console.log(
            JSON.stringify({ event: 'cron_trigger_completed', scheduledTime: controller.scheduledTime, ...result }),
        );
    } catch (error) {
        console.error(
            JSON.stringify({
                event: 'cron_trigger_failed',
                scheduledTime: controller.scheduledTime,
                error: redactErrorForLog(error),
            }),
        );
        throw error;
    }
}
