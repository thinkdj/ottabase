# @ottabase/notifications — agent notes

Multi-channel notification engine (email, WebSocket, system alerts) with drizzle persistence and queue delivery. Full docs: ./README.md

## Use when

- Sending user notifications or admin/system alerts via email, real-time WebSocket, or async queue, with per-user preferences and status tracking.
- NOT for raw transactional email (`@ottabase/email`) or generic realtime pub/sub (`@ottabase/cf-realtime`) — use those directly.

## Imports

```ts
import { NotificationManager, createNotificationManager, createNotificationQueueHandler, dispatchNotification, type NotificationJob } from '@ottabase/notifications';
import { createEmailChannel, createWebSocketChannel, createSystemChannel } from '@ottabase/notifications/channels';
import { NotificationModel, NotificationPreference, notificationsTable, notificationPreferencesTable, systemNotificationsTable } from '@ottabase/notifications/models';
```

## Canonical usage

```ts
const manager = createNotificationManager({ defaultChannels: ['email', 'websocket'] });
manager.registerChannel(createEmailChannel({ mailer, from: 'noreply@example.com' })); // mailer: Mailer from @ottabase/email
manager.registerChannel(createWebSocketChannel({ broadcaster })); // RealtimeBroadcaster from @ottabase/cf-realtime/server
const results = await manager.notify({ recipient: { userId: '123', email: 'user@example.com' }, payload: { title: 'Welcome!', message: 'Thanks for signing up' } });
// SendResult[] — check each result.success; notify() never throws

// Async via queue: manager.setQueue + a consumer-side handler
manager.setQueue(dispatcher); // Dispatcher from @ottabase/queue/job
await manager.notify({ recipient, payload, options: { async: true } });
registry.register('notifications', createNotificationQueueHandler(manager)); // createRegistry() from @ottabase/queue/processor
manager.registerChannel(createSystemChannel({ adminUserIds: ['admin-1'], enableLogging: true }));
await manager.notifySystem({ title: 'DB error', message: 'Pool exhausted', eventType: 'database.error', severity: 'critical' });
```

## Wiring

1. `apps/*/ottabase/config.migrations.ts` — add `notifications: { tables: { notificationsTable, notificationPreferencesTable, systemNotificationsTable } }` (from `'@ottabase/notifications/models'`) to `PACKAGE_REGISTRY`; enable under `customPackages` in `ottabase.config.ts`.
2. `apps/*/ottabase/db/schema.ts` — re-export the three tables.
3. `apps/*/worker/lib/db-utils.ts` — add `NotificationModel` and `NotificationPreference` to `registerModels`; then `POST /api/ottaorm/init`.

## Gotchas

- Channels are NOT auto-wired — construct and `registerChannel()` each; missing channels yield failed SendResults, no throw. The queue handler DOES throw on failure (queue retry).
- Channel routing: `options.channels` > `recipient.channels` > `defaultChannels` (default `['email']`); `NotificationPreference` rows are NOT consulted automatically — enforce prefs yourself.
- Models are fat `BaseModel` subclasses (`@ottabase/ottaorm/base`); pass RLS context. EmailChannel escapes HTML/URLs, but sanitize user input upstream (`@ottabase/utils/sanitize`). Edge-safe.
