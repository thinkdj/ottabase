# @ottabase/cf-scheduler

Database-driven task scheduler with cron support for Cloudflare Workers and D1.

## Features

- 📅 **Database-driven scheduling** - Store and manage scheduled tasks in D1
- ⏰ **Flexible frequencies** - Support for common intervals (every 5 minutes, hourly, daily, etc.)
- 🎯 **Custom cron expressions** - Full cron syntax support for custom schedules
- 🔄 **Auto-retry** - Configurable retry logic for failed tasks
- 📊 **Execution logging** - Track task runs, failures, and performance
- 🎨 **Type-safe** - Full TypeScript support with comprehensive types
- ⚡ **Edge-native** - Built for Cloudflare Workers and D1

## Installation

```bash
pnpm add @ottabase/cf-scheduler
```

## Quick Start

### 1. Register Your Custom Handlers

First, define the custom actions you want to schedule:

```typescript
import { createScheduler } from '@ottabase/cf-scheduler/server';

// Define your task handlers - these are the custom actions
const handlers = {
  'send-summary-email': async (payload) => {
    const { recipients, subject } = payload;
    // Your email sending logic
    await sendEmail(recipients, subject);
    return { success: true, output: { sent: recipients.length } };
  },
  'cleanup-database': async () => {
    // Your cleanup logic
    const deleted = await cleanupOldRecords();
    return { success: true, output: { deleted } };
  },
};

// Create scheduler instance with your handlers
const scheduler = createScheduler(env.DB, { handlers });

// Initialize database schema (run once)
await scheduler.initializeSchema();
```

### 2. Create Scheduled Tasks in Database

Add tasks to the database - the scheduler will automatically run them at the specified times:

```typescript
// Example: Send summary email daily at 1:00 AM
await scheduler.createTask({
  app_id: 'my-app',
  name: 'Send Daily Summary Email',
  description: 'Send summary email to all users',

  // Use custom cron for specific time
  frequency: 'custom',
  cron_expression: '0 1 * * *', // Daily at 1:00 AM UTC

  // Handler name (must match registered handler)
  handler: 'send-summary-email',

  // Metadata/parameters passed to handler
  payload: {
    recipients: ['user@example.com'],
    subject: 'Your Daily Summary',
    template: 'daily-summary',
  },
});
```

### 3. Cloudflare Workers Cron Integration

The scheduler checks the database for due tasks every time Cloudflare triggers it.

In your `wrangler.toml`:

```toml
[triggers]
crons = ["* * * * *"]  # Cloudflare triggers every minute

[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "your-database-id"
```

In your worker:

```typescript
import { createCronHandler } from '@ottabase/cf-scheduler/server';

export default {
  // Scheduled cron handler - Cloudflare calls this every minute
  // It checks the database for tasks that are due to run
  scheduled: createCronHandler({
    database: env.DB,
    handlers: {
      // Same handlers as registered above
      'send-summary-email': async (payload) => {
        const { recipients, subject } = payload;
        await sendEmail(recipients, subject);
        return { success: true, output: { sent: recipients.length } };
      },
      'cleanup-database': async () => {
        // Your cleanup logic
        return { success: true };
      },
    },
    verbose: true, // Enable logging
    maxTasksPerRun: 10, // Process up to 10 tasks per execution
  }),

  // Regular fetch handler for your API
  async fetch(request, env, ctx) {
    // Your API endpoints
  },
};
```

**How it works:**
1. Cloudflare triggers your worker every minute (or your chosen interval)
2. The scheduler queries the database for tasks where `next_run_at <= now`
3. Each due task's handler is executed with its payload
4. Task execution is logged, and `next_run_at` is updated based on the schedule

### 4. Client-Side Usage

```typescript
import { createSchedulerClient } from '@ottabase/cf-scheduler/client';

const client = createSchedulerClient();

// Get all tasks
const tasks = await client.getTasks('my-app');

// Create a task
const task = await client.createTask({
  app_id: 'my-app',
  name: 'Backup Database',
  frequency: 'every_6_hours',
  handler: 'backup-database',
});

// Trigger a task manually
await client.triggerTask(task.id);

// Pause/resume tasks
await client.pauseTask(task.id);
await client.resumeTask(task.id);

// Get execution logs
const logs = await client.getTaskLogs(task.id);
```

## How It Works

The scheduler follows a database-driven approach:

1. **Register Handlers**: Define custom action functions (e.g., `send-summary-email`, `cleanup-database`)
2. **Create Tasks in DB**: Add task entries to the database with:
   - Handler name to execute
   - Schedule (frequency or cron expression)
   - Payload (metadata/parameters for the handler)
3. **Cloudflare Triggers**: Cloudflare Workers cron triggers your worker at regular intervals (e.g., every minute)
4. **Scheduler Checks DB**: On each trigger, the scheduler queries for tasks where `next_run_at <= now`
5. **Execute Tasks**: Due tasks are executed with their payload passed to the registered handler
6. **Update & Log**: Execution results are logged, and `next_run_at` is calculated for the next run

**Example Flow:**
```
User creates task → Stored in D1 → Cloudflare triggers worker →
Scheduler checks DB → Finds due tasks → Acquires lock → Executes handler →
Logs result → Updates next_run_at → Releases lock
```

## Concurrency & Reliability

### Optimistic Locking (Prevents Double-Execution)

The scheduler uses **optimistic locking** to prevent concurrent workers from running the same task twice:

1. When checking for due tasks, the scheduler acquires a lock by setting `execution_lock_id`
2. Only tasks without a lock (or with stale locks >10 minutes old) can be acquired
3. After execution (success or failure), the lock is released
4. If a worker dies mid-execution, the stale lock will be cleared after 10 minutes

**This prevents:**
- ❌ Double-execution when multiple Cloudflare workers run simultaneously
- ❌ Race conditions during concurrent cron triggers
- ❌ Duplicate task processing

### Skip Missed Executions

Set `skip_missed: true` to skip tasks that missed their execution window by >5 minutes:

```typescript
await scheduler.createTask({
  app_id: 'my-app',
  name: 'Time-Sensitive Report',
  frequency: 'daily',
  handler: 'generate-report',
  skip_missed: true, // Skip if worker was down during execution time
});
```

**Use cases:**
- ✅ Time-sensitive reports (don't generate yesterday's report today)
- ✅ Real-time notifications (don't send stale alerts)
- ✅ Scheduled maintenance windows (skip if window passed)

**Default behavior** (`skip_missed: false`):
- Missed tasks run immediately when worker comes back up
- Good for: backups, cleanup, non-time-sensitive tasks

## Supported Frequencies

- `every_minute` - Every minute
- `every_5_minutes` - Every 5 minutes
- `every_10_minutes` - Every 10 minutes
- `every_15_minutes` - Every 15 minutes
- `every_30_minutes` - Every 30 minutes
- `hourly` - Every hour
- `every_2_hours` - Every 2 hours
- `every_4_hours` - Every 4 hours
- `every_6_hours` - Every 6 hours
- `every_12_hours` - Every 12 hours
- `daily` - Once per day (midnight)
- `weekly` - Once per week (Sunday midnight)
- `monthly` - Once per month (1st at midnight)
- `custom` - Custom cron expression

## Custom Cron Expressions

For advanced scheduling, use custom cron expressions:

```typescript
await scheduler.createTask({
  app_id: 'my-app',
  name: 'Complex Schedule',
  frequency: 'custom',
  cron_expression: '0 9,17 * * 1-5', // 9 AM and 5 PM on weekdays
  handler: 'my-handler',
});
```

## Task Handlers

Task handlers receive an optional payload and should return a result:

```typescript
type TaskHandler = (payload?: unknown) => Promise<TaskExecutionResult | void>;

interface TaskExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}
```

Example:

```typescript
const myHandler = async (payload) => {
  const startTime = Date.now();

  try {
    // Your task logic
    const result = await doSomething(payload);

    return {
      success: true,
      output: result,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
};
```

## API Reference

### Scheduler Class

#### `createScheduler(db: D1Database, config?: SchedulerConfig)`

Create a scheduler instance.

#### `initializeSchema(): Promise<void>`

Initialize the D1 database schema. Run this once during setup.

#### `createTask(input: CreateTaskInput): Promise<ScheduledTask>`

Create a new scheduled task.

#### `getTasks(appId?: string): Promise<ScheduledTask[]>`

Get all tasks, optionally filtered by app ID.

#### `getTask(id: string): Promise<ScheduledTask | null>`

Get a single task by ID.

#### `updateTask(id: string, input: UpdateTaskInput): Promise<ScheduledTask | null>`

Update a task.

#### `deleteTask(id: string): Promise<boolean>`

Delete a task.

#### `triggerTask(id: string): Promise<TaskExecutionResult>`

Manually trigger a task execution.

#### `getTaskLogs(taskId: string, limit?: number): Promise<TaskLog[]>`

Get execution logs for a task.

#### `registerHandler(name: string, handler: TaskHandler): void`

Register a task handler function.

## Database Schema

The scheduler creates two tables:

**scheduled_tasks**
- Stores task definitions, schedules, and status
- Tracks execution counts and failures
- Manages retry logic

**task_logs**
- Records each task execution
- Stores execution time and results
- Captures errors and output

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm type-check
```

## License

MIT
