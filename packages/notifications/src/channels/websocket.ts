// ============================================================
// @ottabase/notifications - WebSocket/Realtime Channel
// ============================================================

import type { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
import type { Notification, NotificationChannelHandler, SendResult } from '../types';

/**
 * WebSocket channel configuration
 */
export interface WebSocketChannelConfig {
    /** Realtime broadcaster instance */
    broadcaster: RealtimeBroadcaster;
    /** Default channel prefix */
    channelPrefix?: string;
}

/**
 * WebSocket/Realtime notification channel handler
 *
 * @example
 * ```typescript
 * import { RealtimeBroadcaster } from "@ottabase/cf-realtime/server";
 * import { WebSocketChannel } from "@ottabase/notifications/channels";
 *
 * const broadcaster = new RealtimeBroadcaster(env);
 * const wsChannel = new WebSocketChannel({ broadcaster });
 *
 * await wsChannel.send(notification);
 * ```
 */
export class WebSocketChannel implements NotificationChannelHandler {
    name = 'websocket' as const;
    private config: WebSocketChannelConfig;

    constructor(config: WebSocketChannelConfig) {
        this.config = config;
    }

    async send(notification: Notification): Promise<SendResult> {
        try {
            const { recipient, payload } = notification;
            const prefix = this.config.channelPrefix || 'notification';
            const channel = `${prefix}:user:${recipient.userId}`;

            // Build notification message
            const message = {
                id: notification.id,
                type: 'notification',
                title: payload.title,
                message: payload.message,
                category: payload.category,
                actionUrl: payload.actionUrl,
                actionText: payload.actionText,
                metadata: payload.metadata,
                timestamp: new Date().toISOString(),
            };

            // Broadcast to user's channel
            await this.config.broadcaster.broadcast({
                channels: [channel],
                event: 'notification',
                data: message,
            });

            return {
                success: true,
                messageId: notification.id,
                metadata: {
                    channel,
                    provider: 'websocket',
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!this.config.broadcaster;
    }
}

/**
 * Create a websocket notification channel
 */
export function createWebSocketChannel(config: WebSocketChannelConfig): WebSocketChannel {
    return new WebSocketChannel(config);
}
