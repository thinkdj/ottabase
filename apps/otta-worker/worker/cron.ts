// ============================================================
// Cron — the scheduler over the handlers every package contributes
// ============================================================
// Cloudflare wakes the Worker once a minute; the scheduler runs whatever `scheduled_tasks`
// rows are due. Handlers come from the manifests' `cron` field, schedules are seeded from
// them on init (and on the first tick of an isolate, so a fresh deploy needs no click).
// With OBCF_QUEUE bound each due task is one `cron:run` job, run in its own invocation by
// the core package's consumer; without one the tick runs them inline.
// ============================================================

import {
    CRON_JOB_TYPE,
    createScheduler,
    createTaskRepository,
    type CronJobPayload,
    type TaskExecutionResult,
    type TaskHandler,
} from '@ottabase/cron';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { dispatchBatch } from '@ottabase/queue';
import { getOttabaseConfig } from '../ottabase/config.loader';
import { packages } from '../ottabase/packages';
import { ensureDbConnection } from './lib/db-utils';
import { ensurePackageSchedules } from './lib/package-schedules';

export const scheduler = createScheduler<CloudflareEnv>({
    logger: {
        info: (message) => console.log(JSON.stringify({ event: 'cron_scheduler', level: 'info', message })),
        warn: (message) => console.warn(JSON.stringify({ event: 'cron_scheduler', level: 'warn', message })),
        error: (message) => console.error(JSON.stringify({ event: 'cron_scheduler', level: 'error', message })),
    },
    // One message per run. A refused batch rejects the tick and the rows stay due for the next.
    enqueue: async (env, runs) => {
        if (!env.OBCF_QUEUE) return false;
        const sent = await dispatchBatch(
            env.OBCF_QUEUE,
            runs.map((payload) => ({ type: CRON_JOB_TYPE, payload })),
        );
        if (!sent.success) throw sent.error;
        return true;
    },
});

for (const [name, job] of Object.entries(packages.cron())) {
    scheduler.handler(name, job.handler as TaskHandler<CloudflareEnv, unknown>, job.description);
}

function repository(env: CloudflareEnv) {
    const appId = getOttabaseConfig(env).appId;
    const scoped = {
        due: () => ScheduledTask.due(appId),
        find: (id: string) => ScheduledTask.findForApp(id, appId),
        acquireExecutionLock: (
            id: string,
            startedAt: Date,
            staleBefore: Date,
            requestedAt: Date | null,
            driver: Parameters<typeof ScheduledTask.acquireExecutionLock>[5],
        ) => ScheduledTask.acquireExecutionLock(id, appId, startedAt, staleBefore, requestedAt, driver),
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
    return createTaskRepository(scoped, createD1Driver(env.OBCF_D1));
}

let seededInThisIsolate = false;

export async function handleScheduled(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    if (!env.OBCF_D1) {
        controller.noRetry();
        return;
    }
    ensureDbConnection(env);
    if (!seededInThisIsolate) {
        await ensurePackageSchedules(packages, getOttabaseConfig(env).appId);
        seededInThisIsolate = true;
    }
    const result = await scheduler.tick(env, repository(env));
    console.log(JSON.stringify({ event: 'cron_tick', ...result }));
}

/** The `cron:run` consumer: one run, in this queue invocation, behind the task's lock. */
export async function runQueuedTask(env: CloudflareEnv, run: CronJobPayload): Promise<TaskExecutionResult> {
    ensureDbConnection(env);
    const execution = await scheduler.runQueued(run, env, repository(env));
    console.log(JSON.stringify({ event: 'cron_run', taskId: execution.taskId, status: execution.status }));
    return execution;
}
