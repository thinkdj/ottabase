# @ottabase/queue

Minimal queue system for Cloudflare Workers. Laravel-inspired job dispatching with modular handler registration.

## Installation

```bash
pnpm add @ottabase/queue
```

## Quick Start

### Dispatching Jobs

```ts
import { dispatch, dispatchBatch } from "@ottabase/queue";

// Single job
await dispatch(env.MY_QUEUE, "send-email", {
  to: "user@example.com",
  subject: "Welcome!",
});

// With delay (max 12 hours)
await dispatch(env.MY_QUEUE, "process-order", { orderId: 123 }, {
  delay: 60, // seconds
  maxAttempts: 5,
});

// Batch dispatch
await dispatchBatch(env.MY_QUEUE, [
  { type: "notify-user", payload: { userId: 1 } },
  { type: "notify-user", payload: { userId: 2 } },
]);
```

### Processing Jobs

```ts
import { createRegistry, createQueueHandler } from "@ottabase/queue";

// Create handler registry
const registry = createRegistry<Env>()
  .register("send-email", async (job, ctx) => {
    const { to, subject } = job.payload;
    await sendEmail(to, subject);
  })
  .register("process-order", async (job, ctx) => {
    const { orderId } = job.payload;
    await processOrder(orderId, ctx.env.DB);
  });

// Export in worker
export default {
  fetch: handleRequest,
  queue: createQueueHandler(registry),
};
```

### With Lifecycle Hooks

```ts
const handler = createQueueHandler(registry, {
  onBeforeProcess: async (job, env) => {
    console.log(`Starting: ${job.type}`);
  },
  onAfterProcess: async (job, env) => {
    console.log(`Completed: ${job.type}`);
  },
  onFailure: async (job, error, env) => {
    console.error(`Failed: ${job.type}`, error.message);
  },
});
```

## API

### Dispatching

| Function | Description |
|----------|-------------|
| `dispatch(queue, type, payload, options?)` | Send single job |
| `dispatchBatch(queue, jobs)` | Send multiple jobs |
| `createDispatcher(config)` | Create reusable dispatcher |

### Processing

| Function | Description |
|----------|-------------|
| `createRegistry<Env>()` | Create handler registry |
| `registry.register(type, handler)` | Register job handler |
| `registry.setDefault(handler)` | Handle unknown types |
| `createQueueHandler(registry, options?)` | Create worker export |

### Options

```ts
interface DispatchOptions {
  delay?: number;      // 0-43200 seconds
  maxAttempts?: number;
  tags?: string[];
}
```

## Job Structure

```ts
interface QueuedJob<T> {
  type: string;
  payload: T;
  meta?: {
    id: string;
    dispatchedAt: string;
    attempts: number;
    maxAttempts: number;
    tags: string[];
  };
}
```

## Handler Context

```ts
interface JobContext<E> {
  env: E;           // Worker environment
  attempt: number;  // Current attempt
  message: Message; // Raw CF message
  ack(): void;      // Mark complete
  retry(): void;    // Retry job
}
```

## License

MIT
