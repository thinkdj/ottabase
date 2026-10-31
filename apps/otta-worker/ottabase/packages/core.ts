// ============================================================
// core — what this Worker itself contributes, as a package
// ============================================================
// The scheduler table and the event bus consumer are always present; this manifest
// declares their env, their queue handler and their health so `/api/admin/health` reports
// them next to every other package.
// ============================================================

import { CRON_JOB_TYPE, type CronJobPayload } from '@ottabase/cron';
import { EVENT_JOB_TYPE } from '@ottabase/events';
import { definePackage } from '@ottabase/kernel';
import type { JobHandler } from '@ottabase/queue';
import { events } from '../events';

/** Runs one queued scheduler run. Loaded on use: the cron module reads the package list, which imports this file. */
const runQueuedCronTask: JobHandler<CronJobPayload, CloudflareEnv> = async (job, ctx) => {
    const { runQueuedTask } = await import('../../worker/cron');
    await runQueuedTask(ctx.env, job.payload);
};

export const corePackage = definePackage<CloudflareEnv>({
    key: 'core',
    name: 'Worker core',
    version: '1.0.0',
    description: 'The scheduler, the event bus and the operator token.',
    env: {
        required: ['OBCF_D1'],
        optional: ['OBCF_KV', 'OBCF_R2', 'OBCF_QUEUE', 'ADMIN_TOKEN', { key: 'OBCF_VERSION', kind: 'binding' }],
    },
    queue: {
        // The consumer half of the event bus: runs every `via: 'queue'` subscriber.
        [EVENT_JOB_TYPE]: events.jobHandler(),
        // The consumer half of the scheduler: one task run per job, in its own invocation.
        [CRON_JOB_TYPE]: runQueuedCronTask,
    },
    health: (env) => [
        { name: 'd1', ok: Boolean(env.OBCF_D1) },
        {
            name: 'operator-token',
            ok: Boolean(env.ADMIN_TOKEN) || env.ENVIRONMENT === 'development',
            detail: env.ADMIN_TOKEN ? undefined : 'no ADMIN_TOKEN: operator routes refuse outside development',
        },
        {
            name: 'queue',
            ok: Boolean(env.OBCF_QUEUE),
            detail: env.OBCF_QUEUE ? undefined : 'no queue: queued events and cron runs run inline',
        },
    ],
});
