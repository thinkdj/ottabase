// ============================================================
// @ottabase/notifications - Core Types
// ============================================================

/**
 * Notification channels supported by the system
 */
export type NotificationChannel = 'email' | 'websocket' | 'system';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification status
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

/**
 * Base notification payload
 */
export interface NotificationPayload {
    /** Notification title */
    title: string;
    /** Notification message body */
    message: string;
    /** Additional metadata */
    metadata?: Record<string, any>;
    /** Link/action URL */
    actionUrl?: string;
    /** Action button text */
    actionText?: string;
    /** Notification category/type */
    category?: string;
}

/**
 * Notification recipient configuration
 */
export interface NotificationRecipient {
    /** User ID */
    userId: string;
    /** User email (for email channel) */
    email?: string;
    /** User preferred channels */
    channels?: NotificationChannel[];
    /** User preferences/settings */
    preferences?: Record<string, any>;
}

/**
 * Notification options
 */
export interface NotificationOptions {
    /** Channel(s) to send notification through */
    channels?: NotificationChannel[];
    /** Notification priority */
    priority?: NotificationPriority;
    /** Schedule notification for later */
    scheduledAt?: Date;
    /** Expire notification after date */
    expiresAt?: Date;
    /** Send asynchronously via queue */
    async?: boolean;
    /** Retry configuration */
    retry?: {
        attempts?: number;
        delay?: number;
    };
}

/**
 * Complete notification object
 */
export interface Notification {
    /** Notification ID */
    id?: string;
    /** Recipient information */
    recipient: NotificationRecipient;
    /** Notification payload */
    payload: NotificationPayload;
    /** Notification options */
    options?: NotificationOptions;
    /** Notification status */
    status?: NotificationStatus;
    /** Created timestamp */
    createdAt?: Date;
    /** Sent timestamp */
    sentAt?: Date;
    /** Read timestamp */
    readAt?: Date;
    /** Error information if failed */
    error?: string;
}

/**
 * Channel handler interface - all channels must implement this
 */
export interface NotificationChannelHandler {
    /** Channel name */
    name: NotificationChannel;
    /** Send notification through this channel */
    send(notification: Notification): Promise<SendResult>;
    /** Check if channel is available */
    isAvailable(): Promise<boolean>;
}

/**
 * Result of sending a notification
 */
export interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * System notification (for admins)
 */
export interface SystemNotification {
    /** Notification title */
    title: string;
    /** Notification message */
    message: string;
    /** System event type */
    eventType: string;
    /** Severity level */
    severity: 'info' | 'warning' | 'error' | 'critical';
    /** Event metadata */
    metadata?: Record<string, any>;
    /** Timestamp */
    timestamp?: Date;
}

/**
 * Notification manager configuration
 */
export interface NotificationManagerConfig {
    /** Default channels to use */
    defaultChannels?: NotificationChannel[];
    /** Default priority */
    defaultPriority?: NotificationPriority;
    /** Enable async processing */
    enableAsync?: boolean;
    /** Queue name for async processing */
    queueName?: string;
    /** Email configuration */
    email?: {
        from: string;
        replyTo?: string;
    };
    /** Websocket configuration */
    websocket?: {
        endpoint?: string;
    };
    /** System notification recipients */
    systemAdmins?: string[];
}
