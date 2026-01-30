import { Actor } from '@cloudflare/actors';
import { MessageType } from '../types';
import type {
    RealtimeMessage,
    SubscribeMessage,
    UnsubscribeMessage,
    ChannelMessage,
    BroadcastMessage,
    ErrorMessage,
    ClientConnection,
    OfflineMessage,
    ServerConfig,
    AckMessage,
    PongMessage,
} from '../types';

/**
 * Environment interface for the Actor
 */
export interface RealtimeEnv {
    // Add any environment bindings here
}

/**
 * RealtimeActor handles pub/sub for a specific channel or set of channels
 * Uses Cloudflare Actors built on Durable Objects for state management
 */
export class RealtimeActor extends Actor<RealtimeEnv> {
    private connections: Map<string, WebSocket> = new Map();
    private clientInfo: Map<string, ClientConnection> = new Map();
    private offlineMessages: Map<string, OfflineMessage[]> = new Map();
    private config: ServerConfig;
    private actorState: DurableObjectState;

    constructor(state: DurableObjectState, env: RealtimeEnv) {
        super(state, env);
        this.actorState = state;

        // Default configuration
        this.config = {
            maxConnectionsPerChannel: 1000,
            offlineMessageTTL: 86400, // 24 hours
            maxOfflineMessages: 100,
            enablePersistence: true,
        };
    }

    /**
     * Initialize Actor - load persisted data
     */
    async onInit() {
        if (this.config.enablePersistence) {
            // Load offline messages from storage
            const storedMessages = await this.actorState.storage.get<Map<string, OfflineMessage[]>>('offlineMessages');
            if (storedMessages) {
                this.offlineMessages = new Map(storedMessages);
            }

            // Clean up expired messages
            this.cleanupExpiredMessages();
        }
    }

    /**
     * Handle incoming HTTP requests - primarily for WebSocket upgrades
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Handle WebSocket upgrade
        if (request.headers.get('Upgrade') === 'websocket') {
            const clientId = url.searchParams.get('clientId') || this.generateClientId();
            return this.handleWebSocket(request, clientId);
        }

        // Handle REST API endpoints
        if (url.pathname === '/broadcast' && request.method === 'POST') {
            return this.handleBroadcastRequest(request);
        }

        if (url.pathname === '/stats' && request.method === 'GET') {
            return this.handleStatsRequest();
        }

        if (url.pathname === '/health' && request.method === 'GET') {
            return new Response(JSON.stringify({ status: 'ok', connections: this.connections.size }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response('Not Found', { status: 404 });
    }

    /**
     * Handle WebSocket connection
     */
    private async handleWebSocket(request: Request, clientId: string): Promise<Response> {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept the WebSocket connection
        server.accept();

        // Store connection
        this.connections.set(clientId, server);

        // Initialize client info
        const clientConnection: ClientConnection = {
            clientId,
            channels: new Set(),
            connectedAt: Date.now(),
            lastSeenAt: Date.now(),
        };
        this.clientInfo.set(clientId, clientConnection);

        // Set up message handler
        server.addEventListener('message', async (event) => {
            await this.handleWebSocketMessage(clientId, event.data as string);
        });

        // Handle connection close
        server.addEventListener('close', () => {
            this.handleDisconnect(clientId);
        });

        // Handle errors
        server.addEventListener('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
            this.handleDisconnect(clientId);
        });

        // Send any queued offline messages
        await this.deliverOfflineMessages(clientId);

        // Send connection acknowledgment
        this.sendToClient(clientId, {
            type: 'ack' as MessageType,
            timestamp: Date.now(),
            messageId: clientId,
            channel: 'system',
        } as AckMessage);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    /**
     * Handle incoming WebSocket message
     */
    private async handleWebSocketMessage(clientId: string, data: string) {
        try {
            const message: RealtimeMessage = JSON.parse(data);
            const client = this.clientInfo.get(clientId);

            if (!client) {
                return;
            }

            // Update last seen
            client.lastSeenAt = Date.now();

            switch (message.type) {
                case 'subscribe':
                    await this.handleSubscribe(clientId, message as SubscribeMessage);
                    break;

                case 'unsubscribe':
                    await this.handleUnsubscribe(clientId, message as UnsubscribeMessage);
                    break;

                case 'message':
                    await this.handleMessage(clientId, message as ChannelMessage);
                    break;

                case 'ping':
                    this.sendToClient(clientId, {
                        type: 'pong' as MessageType,
                        timestamp: Date.now(),
                    } as PongMessage);
                    break;

                case 'ack':
                    await this.handleAck(clientId, message as AckMessage);
                    break;

                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error(`Error handling message from ${clientId}:`, error);
            this.sendError(clientId, 'Invalid message format', error);
        }
    }

    /**
     * Handle channel subscription
     */
    private async handleSubscribe(clientId: string, message: SubscribeMessage) {
        const client = this.clientInfo.get(clientId);
        if (!client) return;

        client.channels.add(message.channel);

        // Send acknowledgment
        this.sendToClient(clientId, {
            type: 'ack' as MessageType,
            timestamp: Date.now(),
            messageId: message.id || `sub-${message.channel}`,
            channel: message.channel,
        } as AckMessage);

        // Deliver any offline messages for this channel
        await this.deliverOfflineMessagesForChannel(clientId, message.channel);
    }

    /**
     * Handle channel unsubscription
     */
    private async handleUnsubscribe(clientId: string, message: UnsubscribeMessage) {
        const client = this.clientInfo.get(clientId);
        if (!client) return;

        client.channels.delete(message.channel);

        // Send acknowledgment
        this.sendToClient(clientId, {
            type: 'ack' as MessageType,
            timestamp: Date.now(),
            messageId: message.id || `unsub-${message.channel}`,
            channel: message.channel,
        } as AckMessage);
    }

    /**
     * Handle channel message - broadcast to all subscribers
     */
    private async handleMessage(senderId: string, message: ChannelMessage) {
        const subscribers = this.getChannelSubscribers(message.channel);

        // Broadcast to all online subscribers (except sender if echo is disabled)
        for (const subscriberId of subscribers) {
            if (subscriberId !== senderId) {
                this.sendToClient(subscriberId, message);
            }
        }

        // If message requires acknowledgment and persistence, store for offline clients
        if (message.requiresAck && this.config.enablePersistence) {
            await this.storeOfflineMessage(message);
        }
    }

    /**
     * Handle message acknowledgment
     */
    private async handleAck(clientId: string, message: AckMessage) {
        // Mark message as delivered for this client
        const clientMessages = this.offlineMessages.get(clientId);
        if (clientMessages) {
            const updatedMessages = clientMessages.filter((msg) => msg.id !== message.messageId);
            this.offlineMessages.set(clientId, updatedMessages);
            await this.persistOfflineMessages();
        }
    }

    /**
     * Handle client disconnect
     */
    private handleDisconnect(clientId: string) {
        this.connections.delete(clientId);
        this.clientInfo.delete(clientId);
    }

    /**
     * Handle broadcast request from REST API
     */
    private async handleBroadcastRequest(request: Request): Promise<Response> {
        try {
            const broadcast: BroadcastMessage = await request.json();

            for (const channel of broadcast.channels) {
                const message: ChannelMessage = {
                    type: MessageType.MESSAGE,
                    channel,
                    event: broadcast.event,
                    data: broadcast.data,
                    metadata: broadcast.metadata,
                    timestamp: Date.now(),
                    requiresAck: broadcast.persistForOffline,
                };

                const subscribers = this.getChannelSubscribers(channel);

                // Broadcast to online subscribers
                for (const subscriberId of subscribers) {
                    this.sendToClient(subscriberId, message);
                }

                // Store for offline clients if persistence is enabled
                if (broadcast.persistForOffline && this.config.enablePersistence) {
                    await this.storeOfflineMessage(message);
                }
            }

            return new Response(JSON.stringify({ success: true, channels: broadcast.channels.length }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ success: false, error: String(error) }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    /**
     * Handle stats request
     */
    private handleStatsRequest(): Response {
        const channelStats = new Map<string, number>();

        for (const client of this.clientInfo.values()) {
            for (const channel of client.channels) {
                channelStats.set(channel, (channelStats.get(channel) || 0) + 1);
            }
        }

        const stats = {
            totalConnections: this.connections.size,
            channels: Array.from(channelStats.entries()).map(([channel, count]) => ({
                channel,
                subscriberCount: count,
            })),
            offlineMessagesQueued: Array.from(this.offlineMessages.values()).reduce(
                (sum, messages) => sum + messages.length,
                0,
            ),
        };

        return new Response(JSON.stringify(stats), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Get all subscribers for a channel
     */
    private getChannelSubscribers(channel: string): string[] {
        const subscribers: string[] = [];
        for (const [clientId, client] of this.clientInfo.entries()) {
            if (client.channels.has(channel)) {
                subscribers.push(clientId);
            }
        }
        return subscribers;
    }

    /**
     * Send message to a specific client
     */
    private sendToClient(clientId: string, message: any) {
        const connection = this.connections.get(clientId);
        if (connection && connection.readyState === WebSocket.OPEN) {
            try {
                connection.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Error sending to client ${clientId}:`, error);
                this.handleDisconnect(clientId);
            }
        }
    }

    /**
     * Send error to client
     */
    private sendError(clientId: string, error: string, details?: any) {
        const errorMessage: ErrorMessage = {
            type: MessageType.ERROR,
            timestamp: Date.now(),
            error,
            details,
        };
        this.sendToClient(clientId, errorMessage);
    }

    /**
     * Store offline message for later delivery
     */
    private async storeOfflineMessage(message: ChannelMessage) {
        const offlineMsg: OfflineMessage = {
            id: message.id || this.generateMessageId(),
            channel: message.channel,
            event: message.event,
            data: message.data,
            metadata: message.metadata,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.config.offlineMessageTTL || 86400) * 1000,
            delivered: false,
        };

        // Store for all potential subscribers (simplified - in production you'd track per-user)
        const allClients = Array.from(this.clientInfo.keys());
        for (const clientId of allClients) {
            const client = this.clientInfo.get(clientId);
            if (client?.channels.has(message.channel)) {
                const messages = this.offlineMessages.get(clientId) || [];
                messages.push(offlineMsg);

                // Limit number of stored messages
                if (messages.length > (this.config.maxOfflineMessages || 100)) {
                    messages.shift(); // Remove oldest
                }

                this.offlineMessages.set(clientId, messages);
            }
        }

        await this.persistOfflineMessages();
    }

    /**
     * Deliver all offline messages to a client
     */
    private async deliverOfflineMessages(clientId: string) {
        const messages = this.offlineMessages.get(clientId);
        if (!messages || messages.length === 0) return;

        for (const msg of messages) {
            const channelMessage: ChannelMessage = {
                type: MessageType.MESSAGE,
                channel: msg.channel,
                event: msg.event,
                data: msg.data,
                metadata: { ...msg.metadata, offline: true, queuedAt: msg.createdAt },
                timestamp: Date.now(),
                id: msg.id,
                requiresAck: true,
            };

            this.sendToClient(clientId, channelMessage);
        }
    }

    /**
     * Deliver offline messages for a specific channel
     */
    private async deliverOfflineMessagesForChannel(clientId: string, channel: string) {
        const messages = this.offlineMessages.get(clientId);
        if (!messages || messages.length === 0) return;

        const channelMessages = messages.filter((msg) => msg.channel === channel);

        for (const msg of channelMessages) {
            const channelMessage: ChannelMessage = {
                type: MessageType.MESSAGE,
                channel: msg.channel,
                event: msg.event,
                data: msg.data,
                metadata: { ...msg.metadata, offline: true, queuedAt: msg.createdAt },
                timestamp: Date.now(),
                id: msg.id,
                requiresAck: true,
            };

            this.sendToClient(clientId, channelMessage);
        }
    }

    /**
     * Persist offline messages to durable storage
     */
    private async persistOfflineMessages() {
        if (this.config.enablePersistence) {
            const serializable = Array.from(this.offlineMessages.entries());
            await this.actorState.storage.put('offlineMessages', serializable);
        }
    }

    /**
     * Clean up expired offline messages
     */
    private cleanupExpiredMessages() {
        const now = Date.now();

        for (const [clientId, messages] of this.offlineMessages.entries()) {
            const validMessages = messages.filter((msg) => !msg.expiresAt || msg.expiresAt > now);

            if (validMessages.length === 0) {
                this.offlineMessages.delete(clientId);
            } else if (validMessages.length !== messages.length) {
                this.offlineMessages.set(clientId, validMessages);
            }
        }
    }

    /**
     * Generate unique client ID
     */
    private generateClientId(): string {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Periodic alarm to clean up expired messages
     */
    async onAlarm() {
        this.cleanupExpiredMessages();
        await this.persistOfflineMessages();

        // Schedule next cleanup in 1 hour
        await this.actorState.storage.setAlarm(Date.now() + 3600000);
    }
}
