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
    return async (job: { payload: NotificationJob }) => {
        const { notification, channels } = job.payload;

        // Use public method to send via channels
        try {
            const results = await manager.sendViaChannels(notification, channels);
            // Check if any sends failed
            const hasFailures = results.some((r) => !r.success);
            if (hasFailures) {
                // Throw to trigger queue retry
                throw new Error('Failed to send notification via one or more channels');
            }
        } catch (error) {
            console.error('Error in notification queue handler:', error);
            throw error; // Propagate to allow queue retry
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
