# @ottabase/cron — agent notes

Cron handling for Cloudflare Workers scheduled events — static code-defined jobs or a DB-driven scheduler. Full docs: ./README.md

## Use when

- Running scheduled tasks in a Worker: code-defined cron jobs, Laravel-style DB-managed tasks, or parsing/matching cron expressions.
- NOT for async/retriable background work — dispatch to @ottabase/queue; keep cron handlers fast.

## Imports

```ts
import { createCronHandler, createScheduler, createTaskRepository, parseCron, matchesCron, getNextRun, CronPresets } from '@ottabase/cron';
import type { CronContext, SchedulerContext, TaskRepository, ScheduledTaskRecord } from '@ottabase/cron';
```

## Canonical usage

```ts
// Static jobs — each cron string must also exist in wrangler triggers
const cron = createCronHandler<Env>().on('0 0 * * *', async ({ env }) => cleanupSessions(env.DB));
export default { scheduled: cron.handler };
```

```ts
// DB-driven scheduler — needs a '* * * * *' wrangler cron trigger
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { createD1Driver } from '@ottabase/db/drizzle-d1';

const scheduler = createScheduler<Env>().handler('cleanup:sessions', async ({ env, payload }) => { /* ... */ });
export default {
    async scheduled(event, env, ctx) {
        const repository = createTaskRepository(ScheduledTask, createD1Driver(env.OBCF_D1));
        await scheduler.tick(env, ctx, repository);
    },
};
```

## Gotchas

- All schedules evaluate in UTC; any timezone column is ignored.
- `CronHandler.on` matches `event.cron` by exact string equality against the wrangler trigger.
- `createTaskRepository` needs a DB driver for atomic `acquireLock` across workers; lock-skipped tasks count as `skipped` in `tick()`. Only `taskType === 'handler'` rows run (ScheduledTask model lives in @ottabase/ottaorm, not here).
- `scheduler.runTask(name, env, payload)` runs a handler manually, bypassing locks and DB state.
