---
name: ottabase-queue
description:
    The Ottabase way to run background jobs on Cloudflare Queues (@ottabase/queue). Use for "background job", "send this
    async", "process later", "retry/dedupe a task", "job chaining", "dead-letter queue", or moving slow work off the
    request path. Encodes dispatch + registry + handler wiring.
---

# Background jobs the Ottabase way

`@ottabase/queue` is a Laravel-style job layer over Cloudflare Queues. Dispatch by job type; a handler registry
processes them. The Cloudflare binding plumbing stays hidden behind `dispatch`/`createQueueHandler`.

## Dispatch (producer)

```ts
import { dispatch } from '@ottabase/queue';
await dispatch(env.MY_QUEUE, 'send-email', { to: 'user@example.com' });
```

Richer control via `DispatchOptions` (progressive disclosure — reach for these only when needed): `delay`,
`maxAttempts`, `priority`, `uniqueKey` + `uniqueFor` (dedupe), `tags`, `organizationId`, and `then: [...]` (chaining).
For multiple queues/priority tiers, build a `Dispatcher` with `createDispatcher({ adapter | queue | priorityQueues })`.

## Handle (consumer)

```ts
import { createRegistry, createQueueHandler } from '@ottabase/queue';
const registry = createRegistry<Env>().register('send-email', async (job, ctx) => {
    /* ... */
});
export default { queue: createQueueHandler(registry) };
```

Processor hooks (`onBeforeProcess`/`onAfterProcess`/`onFailure`/`chainQueue`) and a DLQ are available at the lower rung.
The raw `QueueAdapter` / binding is reachable via `dispatcher.getAdapter()` when you genuinely need it.

## Gotchas

- The job **name is a string with no compile-time link to its payload** today — `dispatch(queue, 'send-email', payload)`
  is not checked against the registered handler's payload type. Keep names as shared constants and payload types next to
  the handler to reduce drift. (Typed registries are a known roadmap item.)
- Register the handler for every name you dispatch, or the job fails at runtime.
- Keep job payloads small and serializable; pass IDs, re-fetch inside the handler.
- A new queue binding must be kept in sync across `wrangler.jsonc` and `cloudflare-env.d.ts`.

## Authoritative sources

`AGENTS.MD` → "@ottabase/queue". `packages/queue/README.md`. Full docs: `/llms-full.txt`.
