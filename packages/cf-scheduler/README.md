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

### 1. Server Setup

```typescript
import { createScheduler } from '@ottabase/cf-scheduler/server';
import { createCronHandler } from '@ottabase/cf-scheduler/server';

// Define your task handlers
const handlers = {
  'send-notifications': async (payload) => {
    console.log('Sending notifications...', payload);
    // Your task logic here
    return { success: true, output: { sent: 10 } };
  },
  'cleanup-database': async () => {
    console.log('Cleaning up old records...');
    // Your cleanup logic
    return { success: true };
  },
};

// Create scheduler instance
const scheduler = createScheduler(env.DB, { handlers });

// Initialize database schema (run once)
await scheduler.initializeSchema();

// Create a scheduled task
await scheduler.createTask({
  app_id: 'my-app',
  name: 'Send Daily Notifications',
  description: 'Send notifications to users',
  frequency: 'daily',
  handler: 'send-notifications',
  payload: { type: 'daily-digest' },
});
```

### 2. Cloudflare Workers Cron Integration

In your `wrangler.toml`:

```toml
[triggers]
crons = ["* * * * *"]  # Run every minute
```

In your worker:

```typescript
export default {
  // Regular fetch handler
  async fetch(request, env, ctx) {
    // Your API logic
  },

  // Scheduled cron handler
  scheduled: createCronHandler({
    database: env.DB,
    handlers: {
      'send-notifications': async (payload) => {
        // Task implementation
      },
    },
    verbose: true, // Enable logging
  }),
};
```

### 3. Client-Side Usage

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
