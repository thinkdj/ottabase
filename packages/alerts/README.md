# @ottabase/alerts

Operator alerts for Ottabase apps. Any package (or your own code) calls `raise()` once; the alert reaches **email,
Slack, Discord, Telegram, PagerDuty or a signed webhook**, de-duplicated by a cooldown, capped per channel, rolled into
daily digests where you want them, and retried when a channel is down. The console at **Admin → Infrastructure →
Alerts** manages the channels and shows every alert with where it went.

Alerts are for the people running the app. Mail to your users (receipts, password resets, status-page subscribers) stays
with `@ottabase/email` and `@ottabase/notifications`.

| What                        | How                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Channels                    | email, Slack, Discord, Telegram, PagerDuty (Events API v2), webhook (HMAC-signed)       |
| Routing                     | per channel: a severity floor (info, warning, critical) and an optional source filter   |
| Repeats                     | same key and state inside the cooldown (30 min) are counted, and the next alert says so |
| Busy channels               | over a channel's hourly limit (30), the rest wait and go as one summary                 |
| Digests                     | a channel can send once a day at its hour (UTC) instead of at once                      |
| Critical                    | never capped, never batched                                                             |
| Failures                    | retried after 1, 5, 15 and 60 minutes; a 404 or a revoked token gives up at once        |
| Unhandled errors            | a 5xx, a failed scheduled task, a queue job that gave up: one alert per shape per hour  |
| Outside callers             | `POST /api/alerts/ingest` with a bearer token: CI, a cron box, an uptime robot          |
| `alerts:channels` health    | fails while a channel keeps failing, so Tower sees it through Fleet                     |
| `alerts:sweep`, every 5 min | retries, held-back summaries, digests                                                   |
| `alerts:prune`, daily       | alerts and deliveries older than 30 days                                                |

## Raise one

```typescript
import { alerts } from '../ottabase/packages/alerts'; // the app's one engine

await alerts.raise(env, {
    source: 'app', // who raises it; a channel can take only some sources
    kind: 'import.failed', // what happened, dotted
    severity: 'warning', // info | warning | critical (default warning)
    title: 'Nightly import failed',
    body: 'The supplier feed answered 503 three times.',
    url: '/admin/imports', // an app path becomes a link against AUTH_URL
    fields: [{ label: 'Feed', value: 'supplier-a' }],
    key: 'import:supplier-a', // what makes two alerts "the same" (default source:kind:title)
});
```

`raise()` never throws, and returns `{ id, suppressed, routed }`. Pass `{ waitUntil: (p) => ctx.waitUntil(p) }` as a
third argument from a request to send after the response; without it the sends are awaited.

A condition that clears sends the same `key` with `status: 'resolved'` and the severity of what it resolves: it reaches
the same channels, reads as resolved, and closes the PagerDuty incident its trigger opened. A change of state always
goes out; the cooldown only holds repeats of the same state. `cooldownMs: 0` sends every one (for sources that only
raise on a change, like Tower).

### From a package

A package takes the engine as an optional option typed `AlertSink<Env>` and never imports the engine itself:

```typescript
import type { AlertSink } from '@ottabase/alerts';

export interface MyPackageOptions<Env> {
    alerts?: AlertSink<Env>; // unset: log instead
}
```

The composition passes the app's one engine: `createMyPackage({ alerts })`. Ottabase Pro's Blackbox, Tower, Helpdesk,
Privacy and PayPort work this way, each with an exported mapping (`blackboxAlertInput`, `towerAlertInput`, …) that
decides its own titles, keys and severities.

## Install

`otta add alerts my-app` writes the entry; otta-web ships with it. The composition
(`apps/otta-web/ottabase/packages/alerts.ts`):

```typescript
export const alerts = createAlerts<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    appName: (env) => getOttabaseConfig(env).appName,
    baseUrl: (env) => env.AUTH_URL || null,
    secret: (env) => optional(env.ALERTS_SECRET) ?? env.AUTH_SECRET, // seals channel targets
    emailTo: (env) => optional(env.ALERTS_EMAIL_TO), // a built-in email channel
    ingestToken: (env) => optional(env.ALERTS_INGEST_TOKEN), // opens /ingest
    email: { send: sendMail }, // the app mailer
});

export const alertsPackage = createAlertsPackage<CloudflareEnv>({
    alerts,
    resolveCaller: resolvePackageCaller,
    // An error tracker that alerts on its own makes raw error alerts redundant.
    reportErrors: async () => !(await import('../registry')).packages.has('blackbox'),
});
```

Then `POST /api/ottaorm/init` (or Admin → Database → Init) creates the four tables and seeds the two scheduled tasks.

| Env                   | Effect                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `ALERTS_EMAIL_TO`     | comma-separated addresses: every alert by mail, no console needed. Shown read-only in the console. |
| `ALERTS_SECRET`       | seals channel targets in D1; unset, `AUTH_SECRET`. Changing it means entering each target again.   |
| `ALERTS_INGEST_TOKEN` | opens `POST /api/alerts/ingest`; unset or under 24 characters, the route answers 404.              |

With no channel and no `ALERTS_EMAIL_TO`, alerts are stored and written to the log as one `alert_unrouted` line each.

## Channels

| Type      | Target                                   | Notes                                                                                         |
| --------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| email     | up to 10 addresses                       | through the app mailer                                                                        |
| slack     | an incoming webhook URL                  | `hooks.slack.com` only; Block Kit, no link unfurling                                          |
| discord   | a channel webhook URL                    | `discord.com/api/webhooks/…` only; an embed, never a ping (`allowed_mentions: { parse: [] }`) |
| telegram  | a bot token and a chat id                | HTML, link previews off                                                                       |
| pagerduty | an Events API v2 integration key         | trigger and resolve share `dedup_key` = the alert key; never capped or batched                |
| webhook   | any public `https` URL, a signing secret | JSON, signed like `@ottabase/webhooks` (below)                                                |

Each channel takes a **severity floor** (`info` takes everything) and an optional **source filter**: `blackbox` takes
every Blackbox alert, `tower:app.unreachable` only that kind. **Mode** is `immediate` (with the hourly limit) or
`digest` (one message a day at the digest hour, UTC). A critical alert skips both the limit and the digest.

Every alert is untrusted text: a browser error report, a support mail's subject. Each renderer escapes for its service
(Slack mrkdwn, Discord markdown, Telegram and mail HTML), and only `http(s)` links survive.

### The webhook channel

```http
POST <your url>
Content-Type: application/json
X-Ottabase-Event: alert.firing | alert.resolved | alerts.digest | alerts.held
X-Ottabase-Delivery: <delivery id>
X-Ottabase-Signature: t=<seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">

{ "type": "alert.firing", "app": "Acme", "deliveryId": "…",
  "alert": { "id", "key", "source", "kind", "severity", "status", "title", "body", "url", "fields", "heldBefore", "raisedAt" } }
```

Verify with the same function as `@ottabase/webhooks` deliveries:

```typescript
import { verifySignatureHeader } from '@ottabase/utils/hmac-signature';
const ok = await verifySignatureHeader(secret, rawBody, request.headers.get('X-Ottabase-Signature'));
```

The console shows a generated signing secret once, when the channel is created or its secret rotated. The URL passes the
public-URL policy (`@ottabase/utils/outbound-url`: https, no credentials, no literal private address) and no request
follows a redirect.

### Secrets at rest

Webhook URLs, bot tokens, routing keys and signing secrets are sealed with AES-GCM (a key derived from `ALERTS_SECRET`,
else `AUTH_SECRET`) before they reach D1; the console shows only a harmless hint (`hooks.slack.com/…/x9Qa`). A secret
left blank in a change keeps the stored one. If the key changes, the console marks the channel unreadable and the health
check fails until its target is entered again.

## Unhandled errors

Every error the host reports to the kernel (`registry.report()`: an error-boundary 5xx, a failed scheduled task, a queue
job out of retries) becomes an alert with source `errors` and kind `request`, `cron`, `queue` or `other`, redacted
(`redactErrorForLog`), with the top stack frames. The key is the error's name plus the message's shape (ids, hashes and
numbers removed), never the path, which a caller chooses, with a one-hour cooldown, so a storm of one bug is one alert
an hour. Each isolate also remembers what it raised lately and skips those before touching D1, so the storm costs no
writes either.

`reportErrors: false` (or a function) turns it off. otta-web turns it off when `@ottabase/blackbox` is installed:
Blackbox groups errors into issues and raises its own alerts.

## Outside callers

```bash
curl -X POST https://app.example.com/api/alerts/ingest \
  -H "Authorization: Bearer $ALERTS_INGEST_TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Deploy failed on main","kind":"ci.failed","severity":"critical","key":"deploy","url":"https://ci.example.com/run/42"}'
```

Raised as source `external` (a channel takes `external` or `external:ci.failed`); `key` becomes `external:<key>`, so a
later `"status":"resolved"` with the same key resolves it. 16 KB at most; `202 { id, suppressed, routed }`. The token is
24 characters at least (a shorter one counts as unset), and the package's `rateLimit` option throttles the door by
address before the token is compared; otta-web passes its own limiter.

## Routes

Platform admin, at `/api/alerts`: `GET /channels` (masked, plus the types on offer), `POST /channels`,
`PATCH /channels/:id`, `DELETE /channels/:id` (its unsent deliveries give up), `POST /channels/:id/test`,
`GET /alerts?source=&severity=&before=&limit=` (newest first, with deliveries), `GET /summary`,
`POST /deliveries/:id/retry`. Public with a token: `POST /ingest`.

## Tables

`alert_channels` (targets sealed), `alert_events` (one per alert that went on; held repeats are only counted),
`alert_deliveries` (one per alert per channel: `pending`, `sending`, `sent`, `failed`, `dead`, `held`, `digest`,
`digested`), `alert_keys` (the cooldown's memory, one row per key, moved by one upsert). All partitioned by `app_id`, no
RLS: the operator's rows, reached only through the routes.

## Tests

`pnpm --filter @ottabase/alerts test`. The engine, routes and manifest run on real SQLite (node:sqlite behind Drizzle's
D1 driver) with D1's 100-bound-value limit enforced, a frozen clock and a recording fetch: routing, the cooldown
(including two raises in one millisecond), caps and held summaries, digests, the retry schedule, permanent failures,
sealed and unreadable targets, the ingest door and the error reporter. The renderers are tested for escaping per
service.

## Not yet

Quiet hours, per-channel templates, Microsoft Teams (a webhook channel through Power Automate works today), SMS, and
alerts scoped to one organization for a customer's own view.
