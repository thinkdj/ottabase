# @ottabase/cron

Minimal cron handler for Cloudflare Workers scheduled events.

Two modes:

1. **Static Handler** - Code-defined cron jobs (simple, no DB)
2. **DB Scheduler** - Laravel-style scheduler with tasks in database

> **Note:** All schedules are evaluated in **UTC timezone**. Cloudflare Workers run in UTC, so cron expressions like
> `0 9 * * *` will trigger at 9:00 AM UTC.

## Installation

```bash
pnpm add @ottabase/cron
```

## Static Handler (Code-Defined Jobs)

For simple scheduled tasks defined in code:

```typescript
import { createCronHandler } from '@ottabase/cron';

const cron = createCronHandler<Env>()
    .on('0 0 * * *', async ({ env }) => {
        // Daily at midnight
        await cleanupSessions(env.DB);
    })
    .on('0 * * * *', async ({ env }) => {
        // Every hour
        await sendHourlyDigest(env);
    })
    .on('*/5 * * * *', async ({ env }) => {
        // Every 5 minutes - heavy work? Use queue
        const { dispatch } = await import('@ottabase/queue');
        await dispatch(env.QUEUE, 'heavy-task', {});
    });

export default {
    scheduled: cron.handler,
};
```

### With Hooks

```typescript
const cron = createCronHandler<Env>({
    onBeforeJob: async (ctx) => console.log(`Starting: ${ctx.cron}`),
    onAfterJob: async (ctx) => console.log(`Completed: ${ctx.cron}`),
    onError: async (err, ctx) => console.error(`Failed: ${err.message}`),
});
```

## DB Scheduler (Laravel-Style)

For dynamic tasks managed via database:

### Prerequisites: Database Setup

The DB scheduler requires the `scheduled_tasks` table. Register the `ScheduledTask` model in your app's `registerModels`
array, then create the table through the OttaORM init endpoint:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

Or create the table manually with this schema:

```sql
CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'handler',
  task TEXT NOT NULL,
  payload TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  timezone TEXT DEFAULT 'UTC',
  last_run_at INTEGER,
  next_run_at INTEGER,
  last_status TEXT,
  last_error TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  app_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX scheduled_tasks_due_idx
  ON scheduled_tasks (is_active, next_run_at, id);
```

### 1. Setup the Scheduler

```typescript
import { createScheduler, createTaskRepository, type TaskHandlerDefinitions } from '@ottabase/cron';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { createD1Driver } from '@ottabase/db/drizzle-d1';

interface CronPayloads extends Record<string, unknown> {
    'queue:send-digest': { userId: string };
}

const handlers = {
    'queue:send-digest': {
        description: 'Dispatch the daily digest job.',
        handler: async ({ env, payload }) => {
            await env.QUEUE.send({ type: 'send-digest', payload });
        },
    },
} satisfies TaskHandlerDefinitions<Env, CronPayloads>;

// Keep this registry in one app-owned module. The Worker entrypoint and admin
// handler list should both import this exact scheduler instance.
const scheduler = createScheduler<Env>().registerHandlers<CronPayloads>(handlers);

export default {
    async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
        // Run tick every minute to check for due tasks
        if (controller.cron === '* * * * *') {
            const driver = createD1Driver(env.OBCF_D1);
            const repository = createTaskRepository(ScheduledTask, driver);
            await scheduler.tick(env, repository);
        }
    },
};
```

The `createTaskRepository` requires a database driver for atomic locking - this ensures only one worker executes a task
even when multiple workers are triggered simultaneously.

### 2. Add Tasks to Database

```typescript
import { ScheduledTask } from '@ottabase/ottaorm/models';

// Create a scheduled task
await ScheduledTask.createRegistered(
    {
        name: 'daily-digest',
        description: 'Dispatch the daily digest',
        schedule: '0 0 * * *', // Daily at midnight
        taskType: 'handler',
        task: 'queue:send-digest',
        payload: JSON.stringify({ userId: 'user-123' }),
        isActive: true,
    },
    scheduler.getHandlers().map((handler) => handler.name),
);

// Create with payload
await ScheduledTask.createRegistered(
    {
        name: 'user-digest',
        schedule: '0 9 * * *', // Daily at 9am
        taskType: 'handler',
        task: 'queue:send-digest',
        payload: JSON.stringify({ userId: 'user-123' }),
    },
    scheduler.getHandlers().map((handler) => handler.name),
);
```

The model rejects invalid cron expressions, non-UTC timezones, non-handler task types, unknown registered handlers, and
malformed JSON payloads. It initializes `nextRunAt` during creation, so an active row becomes eligible without a second
setup write.

### 3. Configure wrangler.jsonc

```jsonc
{
    "triggers": {
        "crons": ["* * * * *"], // Every-minute database scheduler tick
    },
}
```

### 4. Pushing to Queue from Scheduled Tasks

Handlers can dispatch jobs to `@ottabase/queue` for heavy/retriable work:

```typescript
import { createScheduler } from '@ottabase/cron';
import { dispatch } from '@ottabase/queue';

const scheduler = createScheduler<Env>()
    // Light work: run directly
    .handler('cleanup:sessions', async ({ env }) => {
        await env.DB.execute('DELETE FROM sessions WHERE expires < ?', [Date.now()]);
    })
    // Heavy work: push to queue for async processing with retries
    .handler('process:reports', async ({ env, payload }) => {
        // Dispatch to queue - will be processed by queue consumer with retries
        await dispatch(env.QUEUE, 'generate-report', {
            reportId: payload.reportId,
            userId: payload.userId,
        });
    })
    // Batch work: fan out to multiple queue jobs
    .handler('daily:notifications', async ({ env }) => {
        const users = await getActiveUsers(env.DB);
        for (const user of users) {
            await dispatch(env.QUEUE, 'send-notification', { userId: user.id });
        }
    });
```

This pattern keeps cron handlers fast (just dispatch) while leveraging queue for:

- Automatic retries on failure
- Parallel processing
- Rate limiting
- Dead letter queue for failed jobs

## Cron Parser Utilities

```typescript
import { parseCron, matchesCron, getNextRun, CronPresets } from '@ottabase/cron';

// Parse expression
const parsed = parseCron('0 9 * * 1-5');
// { minutes: [0], hours: [9], days: [1-31], months: [1-12], weekdays: [1,2,3,4,5] }

// Check if date matches
matchesCron('0 9 * * *', new Date(Date.now())); // true/false

// Get next occurrence
const next = getNextRun('0 0 * * *'); // Next midnight

// Use presets
CronPresets.DAILY; // "0 0 * * *"
CronPresets.HOURLY; // "0 * * * *"
CronPresets.EVERY_5_MINUTES; // "*/5 * * * *"
CronPresets.WEEKDAYS_9AM; // "0 9 * * 1-5"
```

## ScheduledTask Model

The `@ottabase/ottaorm` package includes a `ScheduledTask` model:

```typescript
import { ScheduledTask } from '@ottabase/ottaorm/models';

// Query helpers
const active = await ScheduledTask.active();
const due = await ScheduledTask.due();
const task = await ScheduledTask.findByName('daily-cleanup');

// Definition helper
await task.toggle(); // Toggle active status
```

Execution status is owned by the scheduler repository. It uses the model's atomic lock/complete/fail transitions with
the exact start timestamp as a fencing token; application code should not write `lastStatus`, counters, or run
timestamps directly. Handlers must still be idempotent because reclaiming a Worker that exceeded the lock timeout cannot
undo side effects that Worker already performed.

### Schema

| Column      | Type      | Description                                                           |
| ----------- | --------- | --------------------------------------------------------------------- |
| id          | text      | Primary key (UUID)                                                    |
| name        | text      | Task name                                                             |
| description | text      | Optional description                                                  |
| schedule    | text      | Cron expression                                                       |
| taskType    | text      | `handler` (the only executable type)                                  |
| task        | text      | Name from the application-owned handler registry                      |
| payload     | text      | JSON payload                                                          |
| isActive    | boolean   | Whether task is active                                                |
| timezone    | text      | Reserved for future use (currently ignored, all schedules run in UTC) |
| lastRunAt   | timestamp | Last execution time                                                   |
| nextRunAt   | timestamp | Next scheduled run                                                    |
| lastStatus  | text      | "success", "failed", "running"                                        |
| lastError   | text      | Last error message                                                    |
| runCount    | integer   | Total runs                                                            |
| failCount   | integer   | Failed runs                                                           |

## API Reference

### createCronHandler<Env>(options?)

Create a static cron handler.

### createScheduler<Env>(options?)

Create a DB-driven scheduler.

### CronContext

```typescript
interface CronContext<E> {
    env: E; // Worker environment
    controller: ScheduledController;
    ctx: ExecutionContext;
    cron: string; // Cron expression
    scheduledTime: Date;
}
```

### SchedulerContext

```typescript
interface SchedulerContext<E, P> {
    env: E;
    taskId: string;
    taskName: string;
    schedule: string;
    payload: P | null;
}
```

## License

MIT
