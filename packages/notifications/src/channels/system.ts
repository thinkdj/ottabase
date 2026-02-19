// ============================================================
// @ottabase/notifications - System Channel
// ============================================================

import type { Notification, NotificationChannelHandler, SendResult, SystemNotification } from '../types';

/**
 * System channel configuration
 */
export interface SystemChannelConfig {
    /** Admin user IDs to notify */
    adminUserIds: string[];
    /**
     * Admin emails to notify
     * Note: This is for reference only. To send emails to admins,
     * configure an EmailChannel and use the custom handler.
     */
    adminEmails?: string[];
    /** Custom handler for system notifications */
    handler?: (notification: SystemNotification) => Promise<void>;
    /** Log system notifications */
    enableLogging?: boolean;
}

/**
 * System notification channel handler
 * Used for admin/system alerts and critical notifications
 *
 * @example
 * ```typescript
 * import { SystemChannel } from "@ottabase/notifications/channels";
 *
 * const systemChannel = new SystemChannel({
 *   adminUserIds: ["admin-1", "admin-2"],
 *   adminEmails: ["admin@example.com"],
 *   enableLogging: true
 * });
 *
 * await systemChannel.sendSystemAlert({
 *   title: "Database Error",
 *   message: "Connection pool exhausted",
 *   eventType: "database.error",
 *   severity: "critical"
 * });
 * ```
 */
export class SystemChannel implements NotificationChannelHandler {
    name = 'system' as const;
    private config: SystemChannelConfig;

    constructor(config: SystemChannelConfig) {
        this.config = config;
    }

    async send(notification: Notification): Promise<SendResult> {
        try {
            const systemNotification: SystemNotification = {
                title: notification.payload.title,
                message: notification.payload.message,
                eventType: notification.payload.category || 'system.notification',
                severity: this.mapPriorityToSeverity(notification.options?.priority || 'normal'),
                metadata: notification.payload.metadata,
                timestamp: new Date(),
            };

            // Log if enabled
            if (this.config.enableLogging) {
                console.log('[SYSTEM NOTIFICATION]', {
                    severity: systemNotification.severity,
                    title: systemNotification.title,
                    message: systemNotification.message,
                    eventType: systemNotification.eventType,
                    timestamp: systemNotification.timestamp,
                });
            }

            // Call custom handler if provided
            if (this.config.handler) {
                await this.config.handler(systemNotification);
            }

            return {
                success: true,
                messageId: notification.id,
                metadata: {
                    provider: 'system',
                    admins: this.config.adminUserIds,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Send a system alert to admins
     */
    async sendSystemAlert(alert: SystemNotification): Promise<SendResult> {
        const notification: Notification = {
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
        };

        return this.send(notification);
    }

    async isAvailable(): Promise<boolean> {
        return this.config.adminUserIds.length > 0;
    }

    private mapPriorityToSeverity(priority: string): SystemNotification['severity'] {
        const map: Record<string, SystemNotification['severity']> = {
            low: 'info',
            normal: 'info',
            high: 'warning',
            urgent: 'critical',
        };
        return map[priority] || 'info';
    }

    private mapSeverityToPriority(severity: SystemNotification['severity']): 'low' | 'normal' | 'high' | 'urgent' {
        const map: Record<SystemNotification['severity'], 'low' | 'normal' | 'high' | 'urgent'> = {
            info: 'normal',
            warning: 'high',
            error: 'high',
            critical: 'urgent',
        };
        return map[severity] || 'normal';
    }
}

/**
 * Create a system notification channel
 */
export function createSystemChannel(config: SystemChannelConfig): SystemChannel {
    return new SystemChannel(config);
}
