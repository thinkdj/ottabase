# @ottabase/fleet

The package that makes an Ottabase app watchable. List it, set one secret, and the app answers `GET /api/fleet/report`
with one JSON document: its packages and versions, each Premium Package's license state, the kernel health report, its
scheduled tasks with their last status, and its newest backup. `POST /api/fleet/init` relays whatever init the host
wired (the Worker template passes its database init).

This is deliberately the free half. A cockpit that watches all your apps needs every app on the board to carry Fleet,
including apps run by people who never bought anything; a Fleet behind a paywall would have nothing to report to. The
cockpit itself (Tower: watched apps, polling, history, version drift, alerts, the board) is a paid add-on kept outside
this repository.

## Install

```bash
otta add fleet my-app        # or by hand:
```

```typescript
// apps/otta-web/ottabase/packages/fleet.ts
import { createFleetPackage } from '@ottabase/fleet';

export const fleetPackage = createFleetPackage<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    environment: (env) => env.ENVIRONMENT,
    token: (env) => env.FLEET_TOKEN,
    sources: { backup: async (env) => (await vault.list(env, 1))[0] ?? null },
    licenses: async (env) => (await import('../../worker/lib/premium')).premium.statuses(env),
    // init: initDatabase,  // what POST /api/fleet/init runs; omit and it answers 501
});
```

List `fleetPackage` in `ottabase/packages.ts`, then `wrangler secret put FLEET_TOKEN`. No tables, no nav, no cron. The
health report gains one line, `fleet:token`, saying whether the token is set.

## The report

```bash
curl -H "Authorization: Bearer $FLEET_TOKEN" https://tool.example.workers.dev/api/fleet/report
```

```jsonc
{
    "data": {
        "app": "my-tool",
        "environment": "production",
        "takenAt": 1792584000000,
        "packages": [
            {
                "key": "vault",
                "name": "Vault",
                "version": "1.0.0",
                "premium": { "state": "active", "plan": "pro", "expiresAt": null },
            },
        ],
        "health": { "ok": true, "checks": [{ "package": "core", "name": "env:OBCF_D1", "ok": true }] },
        "tasks": [
            {
                "name": "Nightly backup",
                "task": "vault:backup",
                "isActive": true,
                "lastStatus": "success",
                "lastRunAt": 1792548180000,
                "lastError": null,
                "failCount": 0,
            },
        ],
        "backup": { "id": "20261016T022300Z", "createdAt": "2026-10-16T02:23:00.000Z" },
        "canInit": false,
        "errors": [],
    },
}
```

A source that throws (no bucket, no D1) is named in `errors`; the rest of the report stands. `summarize(report)` is the
shared verdict a board applies: any failing health check, or an active scheduled task whose last run failed, makes the
app `degraded`.

## Why a token, and why a secret

The health report's details name bindings and env vars, so the report is not public: it answers only a bearer token
compared in constant time, and refuses with 503 until one is configured. The token unlocks a read-only report plus
whatever `init` the host chose to expose, and nothing else: no sessions, no admin token, no database.
