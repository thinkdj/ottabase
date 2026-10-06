---
name: ottabase-cron
description:
    The Ottabase way to run scheduled tasks (@ottabase/cron) on Cloudflare Cron Triggers. Use for "schedule a task",
    "run every hour/day", "cron job", "recurring background work", "periodic sync". Encodes the one-tick-per-minute +
    DB-scheduler pattern the app actually uses.
---

# Scheduled tasks the Ottabase way

`@ottabase/cron` is three pieces: a **cron-expression parser**, a **static handler** (code-defined jobs), and a
**DB-driven scheduler** (the one the app uses).

## How the app schedules (DB-driven Scheduler)

Cloudflare wakes the worker once a minute; per-task cadence is evaluated against DB rows.

1. `wrangler.jsonc` → `"triggers": { "crons": ["* * * * *"] }`: one tick/minute.
2. Worker `scheduled:` export → `handleAppScheduled` (guards platform-ready + the tick expression), then
   `runAppCronTick(env)` → `appCronScheduler.tick(env, appTaskRepository(env))` (repository is app-scoped). `tick`
   returns `{ executed, failed, skipped }`; a task whose run or bookkeeping throws counts as `failed` and the tick
   carries on with the remaining due tasks.
3. Register a handler on the app scheduler (`apps/*/ottabase/cron/index.ts`): add an entry to `appCronHandlerRegistry`
   (and its payload type to `AppCronPayloads`); it is passed to `registerHandlers`:
    ```ts
    'my-task': {
        description: 'Shown in the admin cron UI.',
        handler: async ({ env, payload }) => { /* validate payload, then enqueue or do work */ },
    },
    ```
4. Schedule an actual run by creating a `ScheduledTask` row (app-scoped, via the system-admin cron routes /
   `handleAdminCronCreate`) with a cron expression. The repository (`createTaskRepository`) handles atomic locking so a
   task runs once even across overlapping ticks.

Heavy work should be **enqueued** (`OBCF_QUEUE`) from the handler, not done inline, the existing handlers dispatch to
the queue (see `ottabase-queue`).

## Parser utilities (if you just need expression math)

`parseCron(expr)`, `matchesCron(expr, date)`, `getNextRun(expr, after?)` (UTC, standard DOM-OR-DOW), `CronPresets`.
Hand-rolled 5-field parser: no external cron lib.

## Static handler (alternative, code-defined)

`createCronHandler<Env>().on('0 * * * *', handler, 'name')` dispatches by exact `controller.cron` match. Use this only
if you want jobs defined purely in code with their own Cron Triggers, rather than the DB scheduler.

## Gotchas

- The Cloudflare `scheduled` path has no HTTP auth at all, it is guarded by platform-ready + the tick-expression check.
  Admin auth gates the `/api/admin/cron` routes; `checkCronAuth` / `CRON_SECRET` gate separately HTTP-triggered cron
  endpoints (e.g. blog publish-scheduled) and are open when `ENVIRONMENT` is a dev value.
- Cron math is **UTC**. Convert for user-facing schedules.
- Adding a cron trigger changes `wrangler.jsonc`: keep binding/trigger config in sync per the cloudflare rules.

## Authoritative sources

`packages/cron/README.md`, `packages/cron/src/{cron-parser,handler,scheduler}.ts`,
`apps/otta-web/ottabase/cron/index.ts`, `apps/otta-web/worker/routes/admin-cron.ts`. Full docs: `/llms-full.txt`.
