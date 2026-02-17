# Notifications Package Enablement Guide

This guide provides step-by-step instructions to enable the `@ottabase/notifications` package in your Ottabase application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Server-Side Setup](#server-side-setup)
5. [Client-Side Setup](#client-side-setup)
6. [Configuration Options](#configuration-options)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before enabling notifications, ensure you have:

- ✅ `@ottabase/email` package configured (for email notifications)
- ✅ `@ottabase/cf-realtime` package set up (for WebSocket notifications)
- ✅ `@ottabase/queue` configured (optional, for async processing)
- ✅ Cloudflare Workers environment with:
  - D1 database (for storing notifications)
  - Queue binding (optional, for async delivery)
  - Durable Objects enabled (for WebSocket)

## Installation

The package is already included in the monorepo. If installing separately:

```bash
pnpm add @ottabase/notifications
```

## Database Setup

### 1. Add Notification Tables to Your Schema

Import the notification schemas in your Drizzle schema file:

```typescript
// src/ottabase/db/schema.ts (or your schema file)
import {
    notificationsTable,
    notificationPreferencesTable,
    systemNotificationsTable,
} from '@ottabase/notifications/models';

// Export them so they're included in your migrations
export {
    notificationsTable,
    notificationPreferencesTable,
    systemNotificationsTable,
};
```

### 2. Generate and Run Migrations

```bash
# Generate migration
pnpm db:generate

# Apply migration to local D1
pnpm db:push:local

# Apply migration to production D1
pnpm db:push:remote
```

### 3. Verify Tables Created

Check that these tables exist in your D1 database:
- `notifications` - Stores all user notifications
- `notification_preferences` - User notification settings
- `system_notifications` - System/admin alerts

## Server-Side Setup

### 1. Configure Environment Variables

Add to your `.dev.vars` (local) and Cloudflare Workers environment (production):

```bash
# Email Configuration (required for email notifications)
RESEND_API_KEY=re_xxxxx
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com

# Admin Configuration (for system alerts)
ADMIN_USER_IDS=admin-1,admin-2
ADMIN_EMAILS=admin@yourdomain.com

# Queue Configuration (optional, for async delivery)
NOTIFICATION_QUEUE_NAME=notifications
```

### 2. Add Bindings to wrangler.toml

```toml
# For queue-based async notifications (optional)
[[queues.producers]]
queue = "notifications"
binding = "NOTIFICATION_QUEUE"

[[queues.consumers]]
queue = "notifications"
max_batch_size = 10
max_batch_timeout = 30

# For WebSocket notifications (Durable Objects)
[[durable_objects.bindings]]
name = "REALTIME_ACTOR"
class_name = "RealtimeActor"
script_name = "your-worker-name"

[[migrations]]
tag = "v1"
new_classes = ["RealtimeActor"]
```

### 3. Create Notification Manager Instance

```typescript
// src/lib/notifications.ts
import {
    NotificationManager,
    createEmailChannel,
    createWebSocketChannel,
    createSystemChannel,
} from '@ottabase/notifications';
import { createResendMailer } from '@ottabase/email/providers/resend';
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
import type { Env } from './types';

export function createNotificationManager(env: Env) {
    const manager = new NotificationManager({
        defaultChannels: ['email'],
        defaultPriority: 'normal',
        enableAsync: Boolean(env.NOTIFICATION_QUEUE),
        queueName: 'notifications',
        email: {
            from: env.NOTIFICATION_FROM_EMAIL || 'noreply@example.com',
        },
    });

    // Register Email Channel
    const mailer = createResendMailer({
        apiKey: env.RESEND_API_KEY,
    });
    const emailChannel = createEmailChannel({
        mailer,
        from: env.NOTIFICATION_FROM_EMAIL || 'noreply@example.com',
    });
    manager.registerChannel(emailChannel);

    // Register WebSocket Channel (if realtime is enabled)
    if (env.REALTIME_ACTOR) {
        const broadcaster = new RealtimeBroadcaster(env.REALTIME_ACTOR);
        const wsChannel = createWebSocketChannel({
            broadcaster,
            channelPrefix: 'notification',
        });
        manager.registerChannel(wsChannel);
    }

    // Register System Channel (for admin alerts)
    const adminUserIds = env.ADMIN_USER_IDS?.split(',') || [];
    const adminEmails = env.ADMIN_EMAILS?.split(',') || [];
    const systemChannel = createSystemChannel({
        adminUserIds,
        adminEmails,
        enableLogging: true,
    });
    manager.registerChannel(systemChannel);

    // Set queue for async processing (if available)
    if (env.NOTIFICATION_QUEUE) {
        import('@ottabase/queue/job').then(({ Dispatcher }) => {
            const dispatcher = new Dispatcher({
                queue: env.NOTIFICATION_QUEUE,
            });
            manager.setQueue(dispatcher);
        });
    }

    return manager;
}
```

### 4. Add API Endpoints

Create notification endpoints in your Worker:

```typescript
// src/api/notifications/send.ts
import { createNotificationManager } from '@/lib/notifications';
import type { Env } from '@/types';

export async function POST(request: Request, env: Env) {
    const notificationManager = createNotificationManager(env);

    const body = await request.json();
    const { recipientId, recipientEmail, title, message, channel, priority } = body;

    try {
        const results = await notificationManager.notify({
            recipient: {
                userId: recipientId,
                email: recipientEmail,
                channels: channel ? [channel] : undefined,
            },
            payload: {
                title,
                message,
            },
            options: {
                priority: priority || 'normal',
            },
        });

        return Response.json({
            success: results.every(r => r.success),
            results,
        });
    } catch (error) {
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
```

### 5. Set Up Queue Handler (Optional)

If using async queue processing:

```typescript
// src/worker.ts
import { createNotificationQueueHandler } from '@ottabase/notifications';
import { createRegistry, createProcessor } from '@ottabase/queue/processor';
import { createNotificationManager } from '@/lib/notifications';

export default {
    async queue(batch: MessageBatch, env: Env) {
        const notificationManager = createNotificationManager(env);

        const registry = createRegistry();
        registry.register('notifications', createNotificationQueueHandler(notificationManager));

        const processor = createProcessor(registry);
        await processor.process(batch);
    },
};
```

## Client-Side Setup

### 1. Create Notification Hook (Optional)

```typescript
// src/hooks/useNotifications.ts
import { useState, useEffect } from 'react';
import { RealtimeClient } from '@ottabase/cf-realtime/client';

interface Notification {
    id: string;
    title: string;
    message: string;
    timestamp: string;
}

export function useNotifications(userId: string) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [client, setClient] = useState<RealtimeClient | null>(null);

    useEffect(() => {
        // Initialize WebSocket client
        const realtimeClient = new RealtimeClient({
            url: 'wss://your-worker.workers.dev',
        });

        // Subscribe to user's notification channel
        realtimeClient.subscribe(`notification:user:${userId}`, (data) => {
            setNotifications(prev => [data as Notification, ...prev]);
        });

        realtimeClient.connect();
        setClient(realtimeClient);

        return () => {
            realtimeClient.disconnect();
        };
    }, [userId]);

    return { notifications, client };
}
```

### 2. Create Notification Component

```typescript
// src/components/NotificationBell.tsx
import { Bell } from 'lucide-react';
import { Badge } from '@ottabase/ui-shadcn';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell({ userId }: { userId: string }) {
    const { notifications } = useNotifications(userId);
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <button className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    {unreadCount}
                </Badge>
            )}
        </button>
    );
}
```

## Configuration Options

### Notification Manager Options

```typescript
new NotificationManager({
    defaultChannels: ['email', 'websocket'], // Default channels to use
    defaultPriority: 'normal',                 // Default priority level
    enableAsync: true,                         // Enable queue-based delivery
    queueName: 'notifications',                // Queue name for async processing
    email: {
        from: 'noreply@example.com',          // Default from address
        replyTo: 'support@example.com',       // Default reply-to address
    },
    websocket: {
        endpoint: 'wss://...',                 // WebSocket endpoint
    },
    systemAdmins: ['admin-1', 'admin-2'],      // Admin user IDs for system alerts
});
```

### Channel Configurations

**Email Channel:**
```typescript
createEmailChannel({
    mailer: createResendMailer({ apiKey: '...' }),
    from: 'noreply@example.com',
    replyTo: 'support@example.com',
    template: 'default', // Optional template name
});
```

**WebSocket Channel:**
```typescript
createWebSocketChannel({
    broadcaster: new RealtimeBroadcaster(env.REALTIME_ACTOR),
    channelPrefix: 'notification', // Channel name prefix
});
```

**System Channel:**
```typescript
createSystemChannel({
    adminUserIds: ['admin-1', 'admin-2'],
    adminEmails: ['admin@example.com'],
    enableLogging: true,
    handler: async (notification) => {
        // Custom handler for system notifications
        console.log('System alert:', notification);
    },
});
```

## Testing

### 1. Test Email Notifications

```bash
curl -X POST http://localhost:8787/api/admin/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "user-123",
    "recipientEmail": "test@example.com",
    "title": "Test Notification",
    "message": "This is a test",
    "channel": "email",
    "priority": "normal"
  }'
```

### 2. Test WebSocket Notifications

Navigate to `/demo/notifications` in your app and click "Send WebSocket Notification" to test real-time delivery.

### 3. Test System Alerts

```bash
curl -X POST http://localhost:8787/api/admin/notifications/system-alert \
  -H "Content-Type: application/json" \
  -d '{
    "title": "System Alert",
    "message": "Test system notification",
    "severity": "info",
    "eventType": "test.alert"
  }'
```

### 4. Verify Database Records

Check the D1 database to ensure notifications are being stored:

```sql
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
SELECT * FROM notification_preferences WHERE user_id = 'user-123';
SELECT * FROM system_notifications ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Email notifications not sending

- **Check**: Verify `RESEND_API_KEY` is set correctly
- **Check**: Ensure `NOTIFICATION_FROM_EMAIL` is a verified domain in Resend
- **Check**: Look at Worker logs for email provider errors

### WebSocket notifications not received

- **Check**: Verify Durable Objects are enabled in your Cloudflare account
- **Check**: Ensure `REALTIME_ACTOR` binding is configured in wrangler.toml
- **Check**: Client is connecting to the correct WebSocket URL
- **Check**: User is subscribed to the correct channel (`notification:user:{userId}`)

### Async queue not processing

- **Check**: Queue bindings are correctly configured in wrangler.toml
- **Check**: Queue consumer is deployed
- **Check**: Check Cloudflare dashboard for queue metrics and errors
- **Check**: Verify `queue()` handler is implemented in your Worker

### Database errors

- **Check**: Migrations have been applied to D1
- **Check**: D1 binding is configured in wrangler.toml
- **Check**: Database schema matches the notification table definitions

### Notifications not persisting

- **Check**: OttaORM connection is configured
- **Check**: Database write permissions
- **Check**: Table schemas are correctly exported

## Next Steps

Once notifications are enabled:

1. **Customize Email Templates**: Create branded email templates in `@ottabase/email`
2. **Set User Preferences**: Allow users to configure notification channels
3. **Add Notification Categories**: Implement category-based filtering
4. **Monitor Performance**: Track delivery rates and failures
5. **Implement Retry Logic**: Configure retry policies for failed notifications
6. **Add Rate Limiting**: Prevent notification spam

## Support

For issues or questions:
- Check the [README](./README.md) for API documentation
- Review the [demo page](/demo/notifications) for working examples
- Check the [admin page](/admin/notifications) for management interface

---

**Package Version**: 0.1.0
**Last Updated**: 2025-02-17
**Maintainer**: Ottabase Team
