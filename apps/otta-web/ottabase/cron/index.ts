// ============================================================
// Cron — the app's scheduler over the handlers every package contributes
// ============================================================
// Cloudflare fires one trigger a minute; the scheduler runs whatever `scheduled_tasks`
// rows are due. The HANDLERS a task may name come from the package manifests
// (`cron` field, collected by ottabase/packages.ts), so a package ships its housekeeping
// and the admin's handler picker learns about it with no edit here.
// ============================================================

import {
    createScheduler,
    createTaskRepository,
    type SchedulerTickResult,
    type TaskExecutionResult,
    type TaskHandler,
} from '@ottabase/cron';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { resolvePlatformState } from '../../worker/bootstrap';
import { ensureDbConnection } from '../../worker/lib/db-utils';
import { getOttabaseConfig } from '../config.loader';
import { packages } from '../packages';

export const APP_CRON_TICK = '* * * * *';

export const appCronScheduler = createScheduler<CloudflareEnv>({
    logger: {
        info: (message) => console.log(JSON.stringify({ event: 'cron_scheduler', level: 'info', message })),
        warn: (message) => console.warn(JSON.stringify({ event: 'cron_scheduler', level: 'warn', message })),
        error: (message) => console.error(JSON.stringify({ event: 'cron_scheduler', level: 'error', message })),
    },
    // A failing task is already recorded on its scheduled_tasks row; this hands it to the
    // packages that report errors as well. Awaited: a scheduled event has no waitUntil here,
    // and `tick()` awaits this hook, so the reports finish before the event does.
    onError: async (error, context) => {
        await packages.report({ error, env: context.env, source: 'cron', task: context.taskName });
    },
});

for (const [name, job] of Object.entries(packages.cron())) {
    // The manifest types a handler for its own payload; the scheduler hands it the row's JSON.
    appCronScheduler.handler(name, job.handler as TaskHandler<CloudflareEnv, unknown>, job.description);
}

export function getRegisteredAppCronHandlers(): Array<{ name: string; description: string }> {
    return appCronScheduler.getHandlers().map((handler) => ({
        name: handler.name,
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
                reason: platform.reason,
            }),
        );
        return;
    }

    ensureDbConnection(env);
    const result = await runAppCronTick(env);
    console.log(JSON.stringify({ event: 'cron_tick', ...result }));
}
