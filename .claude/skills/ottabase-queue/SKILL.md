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

`createQueueHandler(registry, options)` takes processor options: `onBeforeProcess`/`onAfterProcess`/`onFailure` hooks
and `chainQueue` / `chainPriorityQueues`. There is no built-in DLQ — the README shows the `onFailure` + KV pattern (or
configure a Cloudflare dead-letter queue on the consumer). The raw `QueueAdapter` is reachable via
`dispatcher.getAdapter(priority?)` when you genuinely need it.

## Gotchas

- The job **name is a string with no compile-time link to its payload** today — `dispatch(queue, 'send-email', payload)`
  is not checked against the registered handler's payload type. Keep names as shared constants and payload types next to
  the handler to reduce drift. (Typed registries are a known roadmap item.)
- Register the handler for every name you dispatch, or the job fails at runtime.
- Chaining (`then: [...]`) only fires if the consumer was given `chainQueue` or `chainPriorityQueues`; otherwise the
  chain is skipped with a warning. A chained job uses its own `priority`, else the parent's, else `normal`.
- Keep job payloads small and serializable; pass IDs, re-fetch inside the handler.
- A new queue binding must be kept in sync across `wrangler.jsonc` and `cloudflare-env.d.ts`.

## Authoritative sources

`AGENTS.MD` → "@ottabase/queue". `packages/queue/README.md`. Full docs: `/llms-full.txt`.
