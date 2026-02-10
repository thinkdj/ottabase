// ============================================================
// @ottabase/notifications - Notification table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Notification table schema
 */
export const notificationsTable = sqliteTable('notifications', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `ntf_${crypto.randomUUID()}`),

    // Recipient
    userId: text('user_id').notNull(),
    userEmail: text('user_email'),

    // Payload
    title: text('title').notNull(),
    message: text('message').notNull(),
    category: text('category'),
    actionUrl: text('action_url'),
    actionText: text('action_text'),
    metadata: text('metadata'), // JSON string

    // Delivery
    channels: text('channels').notNull(), // JSON array of channel names
    priority: text('priority').notNull().default('normal'), // low, normal, high, urgent
    status: text('status').notNull().default('pending'), // pending, sent, failed, read

    // Scheduling
    scheduledAt: integer('scheduled_at'),
    expiresAt: integer('expires_at'),

    // Tracking
    sentAt: integer('sent_at'),
    readAt: integer('read_at'),
    error: text('error'),

    // Timestamps
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

/**
 * Notification preference table schema
 */
export const notificationPreferencesTable = sqliteTable('notification_preferences', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    userId: text('user_id').notNull().unique(),

    // Channel preferences
    enableEmail: integer('enable_email', { mode: 'boolean' }).notNull().default(true),
    enableWebSocket: integer('enable_websocket', { mode: 'boolean' }).notNull().default(true),
    enableSystem: integer('enable_system', { mode: 'boolean' }).notNull().default(false),

    // Category preferences (JSON)
    categoryPreferences: text('category_preferences'), // JSON object

    // Timestamps
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

/**
 * System notification table schema
 */
export const systemNotificationsTable = sqliteTable('system_notifications', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    title: text('title').notNull(),
    message: text('message').notNull(),
    eventType: text('event_type').notNull(),
    severity: text('severity').notNull().default('info'), // info, warning, error, critical
    metadata: text('metadata'), // JSON string

    // Tracking
    acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
    acknowledgedBy: text('acknowledged_by'),
    acknowledgedAt: integer('acknowledged_at'),

    // Timestamps
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

/**
 * Notification model types
 */
export type NotificationType = typeof notificationsTable.$inferSelect;
export type NewNotificationType = typeof notificationsTable.$inferInsert;

export type NotificationPreferenceType = typeof notificationPreferencesTable.$inferSelect;
export type NewNotificationPreferenceType = typeof notificationPreferencesTable.$inferInsert;

export type SystemNotificationType = typeof systemNotificationsTable.$inferSelect;
export type NewSystemNotificationType = typeof systemNotificationsTable.$inferInsert;
