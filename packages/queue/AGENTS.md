# @ottabase/queue — agent notes

Laravel-style job dispatching and processing for Cloudflare Queues. Full docs: ./README.md

## Use when

-   Dispatching background jobs to Cloudflare Queues or writing the worker-side `queue` handler: typed handlers, KV dedupe, priority routing, job chaining, failure hooks.
-   NOT for cron/scheduled triggers, and not for non-Cloudflare backends unless you implement a custom `QueueAdapter`.

## Imports

```ts
import { dispatch, dispatchBatch, createJob, Dispatcher, createDispatcher } from '@ottabase/queue';
import { HandlerRegistry, createRegistry, QueueProcessor, createProcessor, createQueueHandler } from '@ottabase/queue';
import type { QueuedJob, DispatchOptions, JobContext, JobHandler, ChainedJob, DedupeStore, PriorityQueues, ProcessorOptions } from '@ottabase/queue';
import { CloudflareAdapter, createCloudflareAdapter, toAdapterBatch } from '@ottabase/queue/adapters';
import type { QueueAdapter, AdapterResult } from '@ottabase/queue/adapters';
// Granular subpaths: '@ottabase/queue/job' and '@ottabase/queue/processor' export the same symbols.
```

## Canonical usage

```ts
// Dispatch (one-off)
await dispatch(env.MY_QUEUE, 'send-email', { to: 'a@b.c' }, { delay: 60, maxAttempts: 5 });

// Dispatcher with dedupe + priorities + chaining
const dispatcher = createDispatcher({
    priorityQueues: { high: env.Q_HIGH, normal: env.Q_NORMAL },
    dedupeStore: env.KV, // KV-shaped { get, put }
});
await dispatcher.dispatch('sync-org', { orgId }, {
    priority: 'high',
    uniqueKey: orgId, uniqueFor: 600, organizationId: orgId,
    then: [{ type: 'notify', payload: { orgId }, delay: 30 }],
});
```

```ts
// Worker-side handler
const registry = createRegistry<Env>()
    .register('send-email', async (job, ctx) => { /* auto-acks on return */ })
    .setDefault(async (job, ctx) => console.warn('unknown job', job.type));
export default {
    fetch: handleFetch,
    queue: createQueueHandler(registry, {
        chainQueue: MY_QUEUE_BINDING, // required for `then:` chains
        onFailure: async (job, error, env) => { /* DLQ hook after max attempts */ },
    }),
};
```

## Gotchas

-   `delay` is seconds, max 43200 (12h, Cloudflare limit).
-   Dedupe (`uniqueKey`) only works via `createDispatcher({ ..., dedupeStore })`; plain `dispatch()` ignores it. Duplicate dispatch returns `{ success: true, data: { dispatched: false } }`.
-   Chained jobs (`then:`) are silently skipped (console.warn) unless the processor gets `chainQueue` or `chainPriorityQueues` in `ProcessorOptions`.
-   Handlers auto-ack on success and auto-retry on throw (default `maxAttempts: 3`); calling `ctx.ack()`/`ctx.retry()` disables auto behavior, including chain dispatch.
-   Unknown job types and malformed bodies are acked (dropped) with a warning; register a `setDefault` handler to catch them.
-   Dedupe keys use `@ottabase/cf/cache-keys` format: `dedupe:org:{orgId}:{type}:{uniqueKey}` (or global without org).
