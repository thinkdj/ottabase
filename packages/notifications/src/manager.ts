// ============================================================
// @ottabase/notifications - Notification Manager
// ============================================================

import type {
    Notification,
    NotificationChannel,
    NotificationChannelHandler,
    NotificationManagerConfig,
    NotificationOptions,
    NotificationPayload,
    NotificationRecipient,
    SendResult,
    SystemNotification,
} from './types';

/**
 * Notification Manager - Orchestrates notification delivery across multiple channels
 *
 * @example
 * ```typescript
 * import { NotificationManager } from "@ottabase/notifications/manager";
 * import { createEmailChannel, createWebSocketChannel } from "@ottabase/notifications/channels";
 *
 * const manager = new NotificationManager({
 *   defaultChannels: ["email", "websocket"],
 *   email: { from: "noreply@example.com" }
 * });
 *
 * manager.registerChannel(emailChannel);
 * manager.registerChannel(wsChannel);
 *
 * await manager.notify({
 *   recipient: { userId: "123", email: "user@example.com" },
 *   payload: {
 *     title: "Welcome!",
 *     message: "Thanks for signing up"
 *   }
 * });
 * ```
 */
export class NotificationManager {
    private channels = new Map<NotificationChannel, NotificationChannelHandler>();
    private config: NotificationManagerConfig;
    private queue?: any; // Queue dispatcher

    constructor(config: NotificationManagerConfig = {}) {
        this.config = {
            defaultChannels: config.defaultChannels || ['email'],
            defaultPriority: config.defaultPriority || 'normal',
            enableAsync: config.enableAsync || false,
            queueName: config.queueName || 'notifications',
            ...config,
        };
    }

    /**
     * Register a notification channel
     */
    registerChannel(channel: NotificationChannelHandler): void {
        this.channels.set(channel.name, channel);
    }

    /**
     * Set the queue dispatcher for async notifications
     */
    setQueue(queue: any): void {
        this.queue = queue;
    }

    /**
     * Send a notification to a user
     */
    async notify(params: {
        recipient: NotificationRecipient;
        payload: NotificationPayload;
        options?: NotificationOptions;
    }): Promise<SendResult[]> {
        const notification: Notification = {
            id: this.generateId(),
            recipient: params.recipient,
            payload: params.payload,
            options: {
                ...params.options,
                priority: params.options?.priority || this.config.defaultPriority,
            },
            status: 'pending',
            createdAt: new Date(),
        };

        // Determine which channels to use
        const channels = this.determineChannels(notification);

        // Handle async delivery
        if (notification.options?.async) {
            if (!this.queue) {
                return [
                    {
                        success: false,
                        error: 'Queue not configured for async notifications',
                    },
                ];
            }
            return this.sendAsync(notification, channels);
        }

        // Send synchronously
        return this.sendSync(notification, channels);
    }

    /**
     * Send a system notification to admins
     */
    async notifySystem(alert: SystemNotification): Promise<SendResult> {
        const systemChannel = this.channels.get('system');
        if (!systemChannel) {
            return {
                success: false,
                error: 'System channel not registered',
            };
        }

        const notification: Notification = {
            id: this.generateId(),
            recipient: {
                userId: 'system',
                channels: ['system'],
            },
            payload: {
                title: alert.title,
                message: alert.message,
                category: alert.eventType,
                metadata: {
                    severity: alert.severity,
                    ...alert.metadata,
                },
            },
            options: {
                channels: ['system'],
                priority: this.mapSeverityToPriority(alert.severity),
            },
            status: 'pending',
            createdAt: new Date(),
        };

        return systemChannel.send(notification);
    }

    /**
     * Send notification synchronously through all channels
     */
    private async sendSync(notification: Notification, channels: NotificationChannel[]): Promise<SendResult[]> {
        const results: SendResult[] = [];

        for (const channelName of channels) {
            const channel = this.channels.get(channelName);
            if (!channel) {
                results.push({
                    success: false,
                    error: `Channel ${channelName} not registered`,
                });
                continue;
            }

            // Check if channel is available
            const available = await channel.isAvailable();
            if (!available) {
                results.push({
                    success: false,
                    error: `Channel ${channelName} not available`,
                });
                continue;
            }

            // Send notification
            const result = await channel.send(notification);
            results.push(result);
        }

        return results;
    }

    /**
     * Send notification asynchronously via queue
     */
    private async sendAsync(notification: Notification, channels: NotificationChannel[]): Promise<SendResult[]> {
        if (!this.queue) {
            return [
                {
                    success: false,
                    error: 'Queue not configured for async notifications',
                },
            ];
        }

        try {
            // Dispatch to queue with correct API
            await this.queue.dispatch(this.config.queueName!, {
                notification,
                channels,
            });

            return [
                {
                    success: true,
                    messageId: notification.id,
                    metadata: {
                        async: true,
                        channels,
                    },
                },
            ];
        } catch (error) {
            return [
                {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            ];
        }
    }

    /**
     * Determine which channels to use for a notification
     */
    private determineChannels(notification: Notification): NotificationChannel[] {
        // Use explicit channels from options
        if (notification.options?.channels) {
            return notification.options.channels;
        }

        // Use recipient's preferred channels
        if (notification.recipient.channels) {
            return notification.recipient.channels;
        }

        // Use default channels
        return this.config.defaultChannels || ['email'];
    }

    /**
     * Generate a unique notification ID
     */
    private generateId(): string {
        return `ntf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Map severity to priority
     */
    private mapSeverityToPriority(severity: SystemNotification['severity']): 'low' | 'normal' | 'high' | 'urgent' {
        const map: Record<SystemNotification['severity'], 'low' | 'normal' | 'high' | 'urgent'> = {
            info: 'normal',
            warning: 'high',
            error: 'high',
            critical: 'urgent',
        };
        return map[severity] || 'normal';
    }

    /**
     * Send notification via specific channels (public method for queue handler)
     */
    async sendViaChannels(notification: Notification, channels: NotificationChannel[]): Promise<SendResult[]> {
        return this.sendSync(notification, channels);
    }

    /**
     * Get all registered channels
     */
    getChannels(): NotificationChannel[] {
        return Array.from(this.channels.keys());
    }

    /**
     * Check if a channel is registered
     */
    hasChannel(channel: NotificationChannel): boolean {
        return this.channels.has(channel);
    }
}

/**
 * Create a notification manager instance
 */
export function createNotificationManager(config?: NotificationManagerConfig): NotificationManager {
    return new NotificationManager(config);
}
