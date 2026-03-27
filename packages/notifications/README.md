# @ottabase/notifications

Minimalistic notifications engine for Ottabase - multi-channel user notifications, system alerts, and real-time updates.

## Features

- **Email Notifications** - Via `@ottabase/email` with multiple provider support
- **Real-time WebSocket** - Via `@ottabase/cf-realtime` for instant updates
- **System Alerts** - Admin notifications for critical events
- **Async Processing** - Queue-based delivery via `@ottabase/queue`
- **User Preferences** - Customizable notification settings per user
- **Persistence** - OttaORM models for notification storage
- **Priority Levels** - Low, normal, high, urgent
- **Tracking** - Status tracking (pending, sent, failed, read)

## Installation

```bash
pnpm add @ottabase/notifications
```

## Quick Start

```typescript
import { NotificationManager, createEmailChannel, createWebSocketChannel } from '@ottabase/notifications';
import { createResendMailer } from '@ottabase/email/providers/resend';
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

// Create channels
const emailChannel = createEmailChannel({
    mailer: createResendMailer({ apiKey: env.RESEND_API_KEY }),
    from: 'noreply@example.com',
});

const wsChannel = createWebSocketChannel({
    broadcaster: new RealtimeBroadcaster(env),
});

// Create manager
const manager = new NotificationManager({
    defaultChannels: ['email', 'websocket'],
    email: { from: 'noreply@example.com' },
});

// Register channels
manager.registerChannel(emailChannel);
manager.registerChannel(wsChannel);

// Send notification
await manager.notify({
    recipient: {
        userId: '123',
        email: 'user@example.com',
    },
    payload: {
        title: 'Welcome to Ottabase!',
        message: 'Thanks for signing up. Get started by exploring our features.',
        actionUrl: 'https://example.com/dashboard',
        actionText: 'Go to Dashboard',
        category: 'welcome',
    },
    options: {
        priority: 'high',
    },
});
```

## Channels

### Email Channel

```typescript
import { createEmailChannel } from '@ottabase/notifications/channels';
import { createResendMailer } from '@ottabase/email/providers/resend';

const emailChannel = createEmailChannel({
    mailer: createResendMailer({ apiKey: env.RESEND_API_KEY }),
    from: 'noreply@example.com',
    replyTo: 'support@example.com',
});

manager.registerChannel(emailChannel);
```

### WebSocket Channel

```typescript
import { createWebSocketChannel } from '@ottabase/notifications/channels';
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';

const wsChannel = createWebSocketChannel({
    broadcaster: new RealtimeBroadcaster(env),
    channelPrefix: 'notification', // Default
});

manager.registerChannel(wsChannel);
```

### System Channel

```typescript
import { createSystemChannel } from '@ottabase/notifications/channels';

const systemChannel = createSystemChannel({
    adminUserIds: ['admin-1', 'admin-2'],
    adminEmails: ['admin@example.com'],
    enableLogging: true,
    handler: async (notification) => {
        // Custom system notification handler
        console.log('System alert:', notification);
    },
});

manager.registerChannel(systemChannel);

// Send system alert
await manager.notifySystem({
    title: 'Database Error',
    message: 'Connection pool exhausted',
    eventType: 'database.error',
    severity: 'critical',
    metadata: { pool: 'primary', connections: 100 },
});
```

## Async Processing with Queue

```typescript
import { Dispatcher } from '@ottabase/queue/job';
import { createNotificationQueueHandler } from '@ottabase/notifications';

// Setup queue dispatcher
const dispatcher = new Dispatcher({
    queue: env.NOTIFICATION_QUEUE,
});

manager.setQueue(dispatcher);

// Send async notification
await manager.notify({
    recipient: { userId: '123', email: 'user@example.com' },
    payload: {
        title: 'Report Ready',
        message: 'Your monthly report is ready to download',
    },
    options: {
        async: true, // Will be queued
        priority: 'low',
    },
});
```

### Queue Handler Setup

```typescript
import { createRegistry, createProcessor } from '@ottabase/queue/processor';
import { createNotificationQueueHandler } from '@ottabase/notifications';

const registry = createRegistry();
registry.register('notifications', createNotificationQueueHandler(manager));

const processor = createProcessor(registry);

// In your queue consumer
export default {
    async queue(batch, env) {
        await processor.process(batch);
    },
};
```

## User Preferences

```typescript
import { NotificationPreference } from '@ottabase/notifications/models';

// Get or create preferences
const prefs = await NotificationPreference.getOrCreate('user-123');

// Update preferences
await prefs.update({
    enableEmail: false,
    enableWebSocket: true,
});

// Set category preferences
await prefs.setCategoryPreference('marketing', false);
await prefs.setCategoryPreference('security', true);

// Get enabled channels
const channels = prefs.getEnabledChannels(); // ['websocket']

// Check category
const enabled = prefs.isCategoryEnabled('security'); // true
```

## Models

### Notification Model

```typescript
import { NotificationModel } from '@ottabase/notifications/models';

// Find user's notifications
const notifications = await NotificationModel.find({ userId: '123' });

// Get unread notifications
const unread = await NotificationModel.getUnread('123');

// Get by category
const security = await NotificationModel.getByCategory('123', 'security');

// Mark as read
await notification.markAsRead();

// Check status
if (notification.isRead()) {
    console.log('Already read');
}

if (notification.isExpired()) {
    console.log('Notification expired');
}
```

## Priority Levels

- `low` - Non-urgent notifications (marketing, updates)
- `normal` - Standard notifications (default)
- `high` - Important notifications (security alerts)
- `urgent` - Critical notifications (system failures)

## Status Tracking

- `pending` - Notification created, not yet sent
- `sent` - Successfully delivered
- `failed` - Delivery failed
- `read` - User has read the notification

## Advanced Usage

### Multiple Channels

```typescript
await manager.notify({
    recipient: {
        userId: '123',
        email: 'user@example.com',
        channels: ['email', 'websocket'], // Override default
    },
    payload: {
        title: 'Security Alert',
        message: 'New login from unknown device',
        category: 'security',
    },
    options: {
        priority: 'urgent',
    },
});
```

### Scheduled Notifications

```typescript
await manager.notify({
    recipient: { userId: '123', email: 'user@example.com' },
    payload: {
        title: 'Reminder',
        message: 'Meeting starts in 30 minutes',
    },
    options: {
        scheduledAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
});
```

### Custom Metadata

```typescript
await manager.notify({
    recipient: { userId: '123', email: 'user@example.com' },
    payload: {
        title: 'Order Shipped',
        message: 'Your order #12345 has been shipped',
        metadata: {
            orderId: '12345',
            trackingNumber: 'ABC123',
            carrier: 'UPS',
        },
    },
});
```

## Integration with Cloudflare Workers

```typescript
import { NotificationManager } from '@ottabase/notifications';

export interface Env {
    NOTIFICATION_QUEUE: Queue;
    RESEND_API_KEY: string;
}

export default {
    async fetch(request: Request, env: Env) {
        const manager = new NotificationManager({
            defaultChannels: ['email'],
            email: { from: 'noreply@example.com' },
        });

        // Setup channels...

        await manager.notify({
            recipient: { userId: '123', email: 'user@example.com' },
            payload: {
                title: 'Hello from Worker',
                message: 'This notification was sent from a Cloudflare Worker',
            },
        });

        return new Response('Notification sent!');
    },
};
```

## TypeScript Support

Full TypeScript support with type definitions:

```typescript
import type {
    Notification,
    NotificationChannel,
    NotificationPayload,
    NotificationRecipient,
    NotificationOptions,
    SendResult,
    SystemNotification,
} from '@ottabase/notifications';
```

## Database Schema

The package includes Drizzle schemas for SQLite:

- `notifications` - Stores all notifications
- `notification_preferences` - User notification preferences
- `system_notifications` - System/admin alerts

To use with your database, import and include in your Drizzle schema:

```typescript
import { notificationsTable, notificationPreferencesTable } from '@ottabase/notifications/models';
```

## License

MIT
