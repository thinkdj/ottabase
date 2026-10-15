# @ottabase/flags

Entitlements for Ottabase apps: plans with features and limits, per-tenant overrides in D1, 402 guards for routes and a
fail-closed client gate.

"What may this caller do, and how much of it?" has two inputs: the **plan** the caller is on (a payport license, a
column on the organization, a static default: the host decides) and **overrides** an operator recorded (a comp, a kill,
a raised ceiling for one customer). One resolver answers both, every paid route asks it, and the browser renders from
the same answer.

## Install

```bash
pnpm add @ottabase/flags
```

## Declare plans, resolve the caller's

```typescript
// apps/otta-web/ottabase/packages/flags.ts
import { createFlags, createFlagsPackage, UNLIMITED } from '@ottabase/flags';

export const flags = createFlags<CloudflareEnv>({
    plans: {
        free: { label: 'Free', limits: { projects: 3 } },
        pro: { label: 'Pro', features: ['export', 'api'], limits: { projects: UNLIMITED } },
    },
    defaultPlan: 'free',
    // Whatever the host knows. Several keys are fine (a user plan and an org plan); the highest-ranked wins.
    resolvePlan: (env, subject) => activeTiers(subject, 'app'), // payport, a column, a gateway header…
    upgradeHref: '/billing',
});

export const flagsPackage = createFlagsPackage<CloudflareEnv>({ flags, resolveCaller });
```

List `flagsPackage` in `ottabase/packages.ts`. That installs the `flag_overrides` table, its model and RLS policy, and
the routes under `/api/flags`.

## Guard a route

```typescript
const denied = await flags.requireFeature(env, subject, 'export');
if (denied) return denied; // 402 UPGRADE_REQUIRED { plan, feature, upgradeHref }

// `current` is the caller's OWN count, measured server-side; a client-supplied number raises its own ceiling.
const full = await flags.requireLimit(env, subject, 'projects', await Project.count(where));
if (full) return full; // 402 UPGRADE_REQUIRED { plan, limitKey, limit }
```

`feature()` and `limit()` return the answer without the response; `resolve()` returns the whole entitlement set.

## Overrides

| Key            | Value          | Effect                                   |
| -------------- | -------------- | ---------------------------------------- |
| `plan`         | a plan key     | Put this subject on that plan            |
| `feature:<id>` | `true`/`false` | Grant or remove one feature              |
| `limit:<id>`   | a number       | Set one ceiling (`-1` lifts it entirely) |

An override has a scope: app-wide, one organization, or one user. They apply narrowest-last, so a user override wins
over an organization's, which wins over the app's. An `expiresAt` makes a trial. Writes go through
`POST /api/flags/overrides` (platform admins) or the `FlagOverride` model, and `flags.invalidate()` drops the cache.

## The client gate

```tsx
import { FlagsProvider, PlanGate, useFeature, usePlan } from '@ottabase/flags/react';

<FlagsProvider request={(path) => api<{ data: unknown }>(path).then((r) => r.data)}>
    <PlanGate feature="export" fallback={<UpgradeNudge />}>
        <ExportButton />
    </PlanGate>
</FlagsProvider>;
```

Gates fail closed while loading, on error and outside the provider. They decide what to render; the server guards decide
what happens.

## Routes

| Method   | Path             | Who            | Returns                            |
| -------- | ---------------- | -------------- | ---------------------------------- |
| `GET`    | `/me`            | signed in      | the caller's `Entitlements`        |
| `GET`    | `/overrides`     | platform admin | overrides, filterable by org/user  |
| `POST`   | `/overrides`     | platform admin | creates one (validated by its key) |
| `DELETE` | `/overrides/:id` | platform admin | removes one                        |

## Design notes

- **Undeclared limits are unlimited**, not zero: a plan that never names a ceiling is saying it does not cap.
- **Cached per subject for 30s** in the isolate (`cacheTtlMs`); writes through the routes invalidate it.
- **No subject, no plan.** An anonymous caller gets 401 from the guards, never the default plan.
- Premium (operator-side licensing of a package) and flags (end-user plans) are different axes on purpose; a payport
  license is one `resolvePlan` source among others.
