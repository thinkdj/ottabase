# @ottabase/cf-realtime — agent notes

Pusher-style real-time pub/sub (WebSockets + offline queuing) on Cloudflare Durable Objects via @cloudflare/actors. Full docs: ./README.md

## Use when

- Channel-based real-time messaging in Cloudflare Workers apps: browser WebSocket clients, server broadcasts, offline queuing, auto-reconnect (used by @ottabase/notifications).
- NOT for non-Cloudflare deployments — requires a Durable Object binding plus wrangler migrations, and Workers Paid plan.

## Imports

```ts
import { RealtimeClient, ConnectionState, MessageType } from '@ottabase/cf-realtime'; // browser/client
import { RealtimeActor, RealtimeBroadcaster } from '@ottabase/cf-realtime/server'; // Worker only
import type { ClientConfig, BroadcastOptions, RealtimeMessage } from '@ottabase/cf-realtime';
```

## Canonical usage

Client (subscribe returns an unsubscribe fn):

```ts
const client = new RealtimeClient({ url: 'wss://your-worker.workers.dev/realtime', clientId: 'user-123' });
await client.connect();
const off = client.subscribe('org-1201', (event, data, metadata) => { /* ... */ });
```

Worker broadcast (binding `OBCF_REALTIME`, default actor id 'global'):

```ts
const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
await broadcaster.broadcast({ channels: ['org-1201'], event: 'updated', data: payload, persistForOffline: true });
```

Wrangler (see examples/wrangler.toml): worker entry must `export { RealtimeActor }`, plus
`[[durable_objects.bindings]] name = "OBCF_REALTIME" class_name = "RealtimeActor"` and a
`[[migrations]] new_classes = ["RealtimeActor"]` entry.

## Gotchas

- Import server code only via `/server` subpath — root export deliberately omits it to keep DO code out of client bundles.
- Any `/api/broadcast`-style endpoint must enforce auth + per-channel publish scopes (use errorResponse(...) from @ottabase/utils/http-errors); otherwise anyone can inject events.
- Sole runtime dep `@cloudflare/actors` is 0.0.1-beta — pin/verify on upgrade.
- No DB schema/models here — no PACKAGE_REGISTRY wiring needed. Depend on it with `workspace:*`.
