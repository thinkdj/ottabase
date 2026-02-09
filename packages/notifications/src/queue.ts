// ============================================================
// @ottabase/notifications - Queue Integration
// ============================================================

import type { NotificationManager } from './manager';
import type { Notification, NotificationChannel } from './types';

/**
 * Notification job payload
 */
export interface NotificationJob {
    notification: Notification;
    channels: NotificationChannel[];
}

/**
 * Create a notification queue handler
 *
 * @example
 * ```typescript
 * import { createNotificationQueueHandler } from "@ottabase/notifications";
 * import { createRegistry } from "@ottabase/queue/processor";
 *
 * const registry = createRegistry();
 * const handler = createNotificationQueueHandler(notificationManager);
 *
 * registry.register("notifications", handler);
 * ```
 */
export function createNotificationQueueHandler(manager: NotificationManager) {
    return async (message: { body: NotificationJob }) => {
        const { notification, channels } = message.body;

        // Send notification through each channel
        for (const channelName of channels) {
            const channel = (manager as any).channels.get(channelName);
            if (!channel) {
                console.warn(`Channel ${channelName} not registered`);
                continue;
            }

            // Check if channel is available
            const available = await channel.isAvailable();
            if (!available) {
                console.warn(`Channel ${channelName} not available`);
                continue;
            }

            // Send notification
            try {
                const result = await channel.send(notification);
                if (!result.success) {
                    console.error(`Failed to send notification via ${channelName}:`, result.error);
                }
            } catch (error) {
                console.error(`Error sending notification via ${channelName}:`, error);
            }
        }
    };
}

/**
 * Dispatch a notification to the queue
 *
 * @example
 * ```typescript
 * import { dispatchNotification } from "@ottabase/notifications";
 * import { Dispatcher } from "@ottabase/queue/job";
 *
 * const dispatcher = new Dispatcher({ queue: env.QUEUE });
 *
 * await dispatchNotification(dispatcher, {
 *   notification: {
 *     recipient: { userId: "123", email: "user@example.com" },
 *     payload: { title: "Hello", message: "World" }
 *   },
 *   channels: ["email", "websocket"]
 * });
 * ```
 */
export async function dispatchNotification(
    dispatcher: any,
    job: NotificationJob,
    options?: {
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        delay?: number;
    },
): Promise<void> {
    await dispatcher.dispatch('notifications', job, options);
}
