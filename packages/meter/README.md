# @ottabase/meter

Usage credits for Ottabase apps: atomic D1 decrements per tenant and meter, period resets, top-ups, a usage ledger and a
402 guard.

"How do I charge for AI usage?" is the question every AI-era SaaS founder asks. The answer is a balance per (tenant,
meter) and ONE conditional `UPDATE` that either takes the credits or does not; D1 says which. No read-then-write, so two
requests racing for the last credit cannot both win. The Cloudflare rate limiter bounds burst; this bounds spend.

## Install

```bash
pnpm add @ottabase/meter
```

## Set up

```typescript
// apps/otta-web/ottabase/packages/meter.ts
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { createMeter, createMeterPackage } from '@ottabase/meter';

export const meter = createMeter<CloudflareEnv>({
    driver: (env) => createD1Driver(env.OBCF_D1),
    upgradeHref: '/billing',
});

export const meterPackage = createMeterPackage<CloudflareEnv>({
    meter,
    resolveCaller,
    appId: (env) => getOttabaseConfig(env).appId,
});
```

List `meterPackage` in `ottabase/packages.ts`. That installs `meter_balances` and `meter_usage`, their models and
policies, the routes under `/api/meter`, and a daily `meter:prune-usage` task.

## Charge for something

```typescript
// Check first when the work is expensive to start; consume after it is done.
const denied = await meter.requireCredits(env, subject, 'ai.tokens', estimate);
if (denied) return denied; // 402 CREDITS_EXHAUSTED, X-Remaining-Credits header

const result = await runTheModel();
const taken = await meter.consume(env, subject, 'ai.tokens', result.usage.totalTokens, { ref: requestId });
if (!taken.ok) return meter.deniedResponse('ai.tokens', taken); // someone else took the last credits meanwhile
```

Or consume first, when the work is cheap to refuse: `consume()` then `refund()` on failure.

## Allowances

```typescript
await meter.grant(env, subject, 'ai.tokens', { credits: 100_000, periodEnd: nextMonth, resetCredits: 100_000 });
await meter.topUp(env, subject, 'ai.tokens', 50_000); // a purchase
await meter.reset(env, subject, 'ai.tokens', { periodEnd: monthAfter }); // a renewal: used → 0, credits → resetCredits
await meter.grant(env, subject, 'exports', { credits: null }); // unlimited
```

`grant` is an upsert and resets `used`; call it when a plan starts or changes. A billing package calls `reset` on every
renewal webhook. Undeclared meters have no balance, which `consume` reports as `NO_BALANCE`.

## Results

| `consume()` returns       | Meaning                                             |
| ------------------------- | --------------------------------------------------- |
| `{ ok: true, remaining }` | Taken; `remaining` is null for an unlimited balance |
| `reason: 'INSUFFICIENT'`  | The amount does not fit; nothing changed            |
| `reason: 'PERIOD_ENDED'`  | The period is over and nobody reset it              |
| `reason: 'NO_BALANCE'`    | No row for this subject and meter                   |

## Routes

| Method | Path         | Who            | Returns                                           |
| ------ | ------------ | -------------- | ------------------------------------------------- |
| `GET`  | `/me`        | signed in      | the caller's balances                             |
| `GET`  | `/me/:meter` | signed in      | one balance with its recent usage                 |
| `GET`  | `/balances`  | platform admin | a subject's balances (`organizationId`, `userId`) |
| `POST` | `/grant`     | platform admin | set an allowance (upsert)                         |
| `POST` | `/top-up`    | platform admin | add credits to a limited balance                  |
| `POST` | `/reset`     | platform admin | start a new period                                |

## Design notes

- **Scopes are strings, not NULLs.** A personal balance stores `organizationId = ''`, an org-wide one `userId = ''`,
  because SQLite treats every NULL as distinct in a unique index.
- **The ledger is best effort.** The balance has already moved when the usage row is written; a ledger hiccup is logged,
  never surfaced as a failed request.
- **The model is for the admin page.** `MeterBalance` and `MeterUsage` make the tables visible to the Database admin and
  the generic CRUD allowlist; the money path is raw SQL on purpose.
- ponytail: one D1 statement is atomic per row; for a global, strongly consistent counter across regions, front the
  meter with a Durable Object (one per tenant, serializing count-then-write) and call `consume` from it.
