/**
 * Cron / Scheduler Configuration
 *
 * The worker's `scheduled()` export (see cloudflare-worker.ts) runs `runScheduled()` on every
 * Cloudflare cron trigger (see wrangler.jsonc `triggers.crons`). It processes any due rows in the
 * `scheduled_tasks` table (managed via /api/admin/cron) whose `task` matches a handler registered
 * below — the DB-driven, Laravel-style scheduler from @ottabase/cron.
 *
 * To add a scheduled job:
 *   1. Register a handler here with `.handler('my-job', async ({ env, payload }) => { ... })`.
 *   2. Create a ScheduledTask (POST /api/admin/cron) with `taskType: 'handler'`, `task: 'my-job'`,
 *      and a cron `schedule` (e.g. "0 3 * * *").
 */

import { createScheduler, createTaskRepository, type Scheduler } from '@ottabase/cron';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import type { CloudflareEnv } from '../../cloudflare-env';

/**
 * Build the app scheduler with its registered task handlers.
 *
 * Two self-contained maintenance jobs ship by default (schedule them via /api/admin/cron to make
 * them run). Add your own handlers alongside them.
 */
export function createAppScheduler(): Scheduler<CloudflareEnv> {
    return createScheduler<CloudflareEnv>()
        .handler(
            'cleanup-expired-sessions',
            async ({ env }) => {
                if (!env.OBCF_D1) return;
                await env.OBCF_D1.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run();
            },
            'Delete Auth.js sessions past their expiry.',
        )
        .handler(
            'cleanup-expired-verification-tokens',
            async ({ env }) => {
                if (!env.OBCF_D1) return;
                await env.OBCF_D1.prepare('DELETE FROM verification_tokens WHERE expires < ?').bind(Date.now()).run();
            },
            'Delete expired email-verification / password-reset tokens.',
        );
}

/**
 * Process all due scheduled tasks. Called from the worker's `scheduled()` handler on each cron tick.
 * A no-op when D1 is unbound. Uses the DB driver's atomic lock so overlapping ticks don't
 * double-run a task.
 */
export async function runScheduled(
    env: CloudflareEnv,
    ctx: { waitUntil: (promise: Promise<unknown>) => void },
): Promise<void> {
    if (!env.OBCF_D1) return;

    const driver = createD1Driver(env.OBCF_D1);
    const scheduler = createAppScheduler();
    const repository = createTaskRepository(ScheduledTask as any, driver as any);

    await scheduler.tick(env, ctx, repository);
}
