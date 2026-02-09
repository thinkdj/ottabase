// ============================================================
// @ottabase/notifications - Notification Model
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm/base';
import { notificationsTable } from './Notification.schema';

export { notificationsTable, type NewNotificationType, type NotificationType } from './Notification.schema';

/**
 * Notification model for storing user notifications
 *
 * @example
 * ```typescript
 * import { NotificationModel } from "@ottabase/notifications/models";
 *
 * // Find user's notifications
 * const notifications = await NotificationModel.find({ userId: "123" });
 *
 * // Create notification
 * const notification = await NotificationModel.create({
 *   userId: "123",
 *   userEmail: "user@example.com",
 *   title: "Welcome",
 *   message: "Thanks for signing up",
 *   channels: JSON.stringify(["email", "websocket"]),
 *   priority: "normal"
 * });
 *
 * // Mark as read
 * await notification.markAsRead();
 * ```
 */
export class NotificationModel extends BaseModel {
    static entity = 'notifications';
    static table = notificationsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/notifications';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Notification';
    static displayNamePlural = 'Notifications';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        sentAt: 'date' as const,
        readAt: 'date' as const,
        scheduledAt: 'date' as const,
        expiresAt: 'date' as const,
    };

    static writable = {
        create: [
            'userId',
            'userEmail',
            'title',
            'message',
            'category',
            'actionUrl',
            'actionText',
            'metadata',
            'channels',
            'priority',
            'scheduledAt',
            'expiresAt',
        ],
        update: ['status', 'sentAt', 'readAt', 'error'],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        userId: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'User ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        userEmail: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'Email',
            },
            tableConfig: {
                visible: true,
            },
        },
        title: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'Title',
            },
            tableConfig: {
                visible: true,
            },
        },
        message: {
            type: 'text',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'Message',
            },
            tableConfig: {
                visible: true,
            },
        },
        category: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Category',
            },
            tableConfig: {
                visible: true,
            },
        },
        status: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Status',
            },
            tableConfig: {
                visible: true,
            },
        },
        priority: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Priority',
            },
            tableConfig: {
                visible: true,
            },
        },
        channels: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Channels',
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
            },
        },
        sentAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Sent',
            },
            tableConfig: {
                visible: true,
            },
        },
        readAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Read',
            },
            tableConfig: {
                visible: true,
            },
        },
    };

    /**
     * Mark notification as sent
     */
    async markAsSent(): Promise<void> {
        await this.update({
            status: 'sent',
            sentAt: Date.now(),
        });
    }

    /**
     * Mark notification as read
     */
    async markAsRead(): Promise<void> {
        await this.update({
            status: 'read',
            readAt: Date.now(),
        });
    }

    /**
     * Mark notification as failed
     */
    async markAsFailed(error: string): Promise<void> {
        await this.update({
            status: 'failed',
            error,
        });
    }

    /**
     * Check if notification is read
     */
    isRead(): boolean {
        return this.get('status') === 'read';
    }

    /**
     * Check if notification is expired
     */
    isExpired(): boolean {
        const expiresAt = this.get('expiresAt');
        if (!expiresAt) return false;
        return Date.now() > expiresAt;
    }

    /**
     * Get unread notifications for a user
     */
    static async getUnread(userId: string): Promise<NotificationModel[]> {
        return this.find({
            userId,
            status: 'pending',
        });
    }

    /**
     * Get notifications by category
     */
    static async getByCategory(userId: string, category: string): Promise<NotificationModel[]> {
        return this.find({
            userId,
            category,
        });
    }
}
