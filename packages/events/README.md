# @ottabase/events

Typed in-process event bus for Ottabase apps and packages, with optional queue fan-out for slow subscribers.

A package announces that something happened (`payport.license.activated`, `ottablog.post.published`); other packages
subscribe without the emitter knowing who listens. One bus per app, created in the app's wiring. Packages contribute
subscriptions through their manifest (`@ottabase/kernel`), so a lifecycle-email package can react to a billing event
without either package importing the other.

## Install

```bash
pnpm add @ottabase/events
```

## Quick start

```typescript
import { createEventBus } from '@ottabase/events';

// Declare the events once per package; intersect the maps in the app.
export type UserEvents = {
    'user.created': { userId: string; email: string };
};

// The app owns the bus.
export const events = createEventBus<CloudflareEnv, UserEvents>({
    queue: (env) => env.OBCF_QUEUE ?? null,
});

// A package subscribes (a manifest does this for you).
events.on('user.created', async (event, { env, defer }) => {
    defer(sendWelcomeMail(env, event.payload.email)); // runs after the response when emit() got waitUntil
});

// Something happens.
await events.emit(env, 'user.created', { userId, email }, { actor: { userId }, defer: (p) => ctx.waitUntil(p) });
```

## The envelope

Every subscriber receives the same `OttaEvent`:

| Field     | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `id`      | Unique per emission; identical for every subscriber            |
| `name`    | The event name                                                 |
| `payload` | Typed by the event map                                         |
| `at`      | Epoch milliseconds at emission                                 |
| `actor`   | `{ userId, organizationId, appId }` from the session, if given |

The envelope is plain JSON on purpose: it is the body of the queue job.

## Inline or queued

| `via`      | Runs                                              | For                                             |
| ---------- | ------------------------------------------------- | ----------------------------------------------- |
| `'inline'` | In the emitting request, before `emit()` resolves | Bookkeeping, counters, writing a row            |
| `'queue'`  | In the queue consumer, one job per event          | Mail, third-party calls, anything slow or flaky |

`emit()` dispatches **one** job (type `events:deliver`) for all queued subscribers of an event. Register
`bus.jobHandler()` under that type in your queue registry; it runs the queued subscribers and throws if one fails, so
the queue retries. Queued handlers must therefore be idempotent, which is the ordinary queue contract.

Without a queue (local dev, a Worker with no binding), queued subscribers run inline. A missing binding never drops an
event.

## Failure isolation

A subscriber that throws is reported to `onError` (default: one redacted structured line on `console.error`) and counted
in `EmitResult.failed`. It never stops other subscribers and never rejects `emit()`. The emitter's request succeeds even
when a listener is broken; that is the whole point of decoupling them.

## Deferred work

`ctx.defer(promise)` hands slow work to the request's `waitUntil` when `emit()` received one. When it did not (cron,
tests, a queue consumer), the promise is awaited before `emit()` resolves, so nothing is silently dropped.

## API

- `createEventBus<Env, Events>(options?)` → `EventBus`
- `bus.on(event | '*', handler, { via?, name? })` → unsubscribe function
- `bus.subscribe(subscriptions)` — register a manifest's list
- `bus.emit(env, name, payload, { actor?, defer?, id? })` → `{ id, delivered, queued, failed }`
- `bus.deliver(env, envelope)` — the consumer half
- `bus.jobHandler()` — a `@ottabase/queue` handler for `EVENT_JOB_TYPE`
- `bus.subscribers(event?)` — what is listening

Event names are dotted lowercase segments (`payport.license.activated`); anything else throws at subscription time.
