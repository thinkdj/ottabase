# @ottabase/queue

Minimal queue system for Cloudflare Workers. Laravel-inspired job dispatching with modular handler registration.

## Installation

```bash
pnpm add @ottabase/queue
```

## Quick Start

### Dispatching Jobs

```ts
import { dispatch, dispatchBatch } from '@ottabase/queue';

// Single job
await dispatch(env.MY_QUEUE, 'send-email', {
    to: 'user@example.com',
    subject: 'Welcome!',
});

// With delay (max 12 hours)
await dispatch(
    env.MY_QUEUE,
    'process-order',
    { orderId: 123 },
    {
        delay: 60, // seconds
        maxAttempts: 5,
    },
);

// Batch dispatch
await dispatchBatch(env.MY_QUEUE, [
    { type: 'notify-user', payload: { userId: 1 } },
    { type: 'notify-user', payload: { userId: 2 } },
]);
```

### Processing Jobs

```ts
import { createRegistry, createQueueHandler } from '@ottabase/queue';

const registry = createRegistry<Env>()
    .register('send-email', async (job, ctx) => {
        const { to, subject } = job.payload;
        await sendEmail(to, subject);
    })
    .register('process-order', async (job, ctx) => {
        await processOrder(job.payload.orderId, ctx.env.DB);
    });

// Export in worker
export default {
    fetch: handleRequest,
    queue: createQueueHandler(registry),
};
```

## Deduplication

Prevent duplicate jobs within a time window using KV:

```ts
import { createDispatcher } from '@ottabase/queue';

const dispatcher = createDispatcher({
    queue: env.MY_QUEUE,
    dedupeStore: env.KV, // Cloudflare KV namespace
});

// Won't dispatch if same uniqueKey sent within 5 minutes (default)
await dispatcher.dispatch(
    'sync-user',
    { userId: 123 },
    {
        uniqueKey: 'user-123',
        uniqueFor: 300, // TTL in seconds (optional, default 300)
    },
);

// Result shows if job was actually dispatched
const result = await dispatcher.dispatch(
    'sync-user',
    { userId: 123 },
    {
        uniqueKey: 'user-123',
    },
);
// result.data.dispatched === false (duplicate skipped)
```

## Job Chaining

Dispatch follow-up jobs automatically after success:

```ts
await dispatch(
    env.MY_QUEUE,
    'process-order',
    { orderId: 123 },
    {
        then: [
            { type: 'send-receipt', payload: { orderId: 123 } },
            { type: 'notify-warehouse', payload: { orderId: 123 }, delay: 60 },
            { type: 'schedule-followup', payload: { orderId: 123 }, delay: 86400 },
        ],
    },
);
```

Enable chaining in processor:

```ts
const handler = createQueueHandler(registry, {
    chainQueue: env.MY_QUEUE, // Required for chaining
});
```

## Priority Queues

Route jobs to different queues based on priority:

```ts
import { createDispatcher } from '@ottabase/queue';

// Configure with multiple queues
const dispatcher = createDispatcher({
    priorityQueues: {
        high: env.HIGH_PRIORITY_QUEUE,
        normal: env.NORMAL_QUEUE,
        low: env.LOW_PRIORITY_QUEUE,
    },
    defaultPriority: 'normal',
});

// Dispatch with priority
await dispatcher.dispatch(
    'urgent-alert',
    { message: 'Server down!' },
    {
        priority: 'high',
    },
);

await dispatcher.dispatch(
    'cleanup-task',
    { older: 30 },
    {
        priority: 'low',
    },
);
```

In `wrangler.toml`:

```toml
[[queues.producers]]
queue = "high-priority-queue"
binding = "HIGH_PRIORITY_QUEUE"

[[queues.producers]]
queue = "normal-queue"
binding = "NORMAL_QUEUE"

[[queues.producers]]
queue = "low-priority-queue"
binding = "LOW_PRIORITY_QUEUE"
```

## Lifecycle Hooks

```ts
const handler = createQueueHandler(registry, {
    onBeforeProcess: async (job, env) => {
        console.log(`Starting: ${job.type}`);
    },
    onAfterProcess: async (job, env) => {
        console.log(`Completed: ${job.type}`);
    },
    onFailure: async (job, error, env) => {
        // Store in Dead Letter Queue for manual retry
        await storeToDLQ(env.KV, job, error);
    },
    chainQueue: env.MY_QUEUE, // Enable job chaining
});
```

## Dead Letter Queue (DLQ)

Use `onFailure` hook to store failed jobs for manual retry:

```ts
// Store failed job with full payload for retry
async function storeToDLQ(kv: KVNamespace, job: QueuedJob, error: Error) {
    const key = `dlq:${Date.now()}:${job.meta?.id}`;
    await kv.put(
        key,
        JSON.stringify({
            id: job.meta?.id,
            type: job.type,
            payload: job.payload,
            error: error.message,
            failedAt: new Date().toISOString(),
            attempts: job.meta?.attempts || 1,
        }),
        { expirationTtl: 604800 },
    ); // 7 days
}

// Retry a job from DLQ
async function retryFromDLQ(queue: Queue, kv: KVNamespace, jobId: string) {
    const job = await kv.get(`dlq:${jobId}`, 'json');
    if (!job) return { success: false, error: 'Not found' };

    await dispatch(queue, job.type, job.payload);
    await kv.delete(`dlq:${jobId}`);
    return { success: true };
}
```

See `ottabase/queue/index.ts` in the template app for a complete DLQ implementation with:

- Paginated listing (handles 100k+ jobs)
- Single/bulk retry
- Purge functionality
- Admin UI integration

## API Reference

### Dispatching

| Function                                   | Description                |
| ------------------------------------------ | -------------------------- |
| `dispatch(queue, type, payload, options?)` | Send single job            |
| `dispatchBatch(queue, jobs)`               | Send multiple jobs         |
| `createDispatcher(config)`                 | Create reusable dispatcher |

### Processing

| Function                                 | Description             |
| ---------------------------------------- | ----------------------- |
| `createRegistry<Env>()`                  | Create handler registry |
| `registry.register(type, handler)`       | Register job handler    |
| `registry.setDefault(handler)`           | Handle unknown types    |
| `createQueueHandler(registry, options?)` | Create worker export    |

### DispatchOptions

```ts
interface DispatchOptions {
    delay?: number; // 0-43200 seconds
    maxAttempts?: number; // Default: 3
    tags?: string[];
    priority?: 'high' | 'normal' | 'low';
    uniqueKey?: string; // Deduplication key
    uniqueFor?: number; // Dedup TTL (default: 300s)
    then?: ChainedJob[]; // Jobs to dispatch on success
}
```

### Job Structure

```ts
interface QueuedJob<T> {
    type: string;
    payload: T;
    meta?: {
        id: string;
        dispatchedAt: string;
        attempts: number;
        maxAttempts?: number;
        tags?: string[];
        priority?: 'high' | 'normal' | 'low';
        chain?: ChainedJob[];
    };
}
```

### Handler Context

```ts
interface JobContext<E> {
    env: E; // Worker environment
    attempt: number; // Current attempt
    message: Message; // Raw CF message
    ack(): void; // Mark complete (prevents auto-ack)
    retry(): void; // Retry job (prevents auto-ack)
}
```

**Auto-ack behavior:** Jobs are automatically acknowledged (acked) when the handler completes successfully. If you call
`ctx.ack()` or `ctx.retry()` explicitly, the auto-ack is disabled—so it's safe to call these methods and return normally
without double-acking.

## License

MIT
