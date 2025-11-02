import {
  ConnectionState,
  MessageType,
} from "../types";
import type {
  ClientConfig,
  MessageHandler,
  ConnectionStateHandler,
  ErrorHandler,
  RealtimeMessage,
  ChannelMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  PingMessage,
  AckMessage,
} from "../types";

/**
 * RealtimeClient - Browser/Node.js client for subscribing to channels
 * Pusher-like API for real-time pub/sub
 */
export class RealtimeClient {
  private config: Required<ClientConfig>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private stateHandlers: Set<ConnectionStateHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(config: ClientConfig) {
    this.config = {
      url: config.url,
      clientId: config.clientId || this.generateClientId(),
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      pingInterval: config.pingInterval ?? 30000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Connect to the realtime server
   */
  async connect(): Promise<void> {
    if (this.ws && this.state === ConnectionState.CONNECTED) {
      this.log("Already connected");
      return;
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      const url = new URL(this.config.url);
      url.searchParams.set("clientId", this.config.clientId);

      this.ws = new WebSocket(url.toString());

      this.ws.addEventListener("open", () => {
        this.log("Connected to server");
        this.setState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.startPing();

        // Resubscribe to all channels
        for (const channel of this.subscriptions.keys()) {
          this.sendSubscribe(channel);
        }
      });

      this.ws.addEventListener("message", (event: MessageEvent) => {
        this.handleMessage(event.data as string);
      });

      this.ws.addEventListener("close", () => {
        this.log("Disconnected from server");
        this.setState(ConnectionState.DISCONNECTED);
        this.stopPing();

        if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.setState(ConnectionState.FAILED);
        }
      });

      this.ws.addEventListener("error", () => {
        this.log("WebSocket error");
        this.emitError(new Error("WebSocket error"));
      });
    } catch (error) {
      this.log("Connection error:", error);
      this.setState(ConnectionState.FAILED);
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Subscribe to a channel
   * @param channel - Channel name (e.g., "org-1201", "user-22", "system")
   * @param handler - Message handler callback
   */
  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.sendSubscribe(channel);
    }

    const handlers = this.subscriptions.get(channel)!;
    handlers.add(handler);

    this.log(`Subscribed to channel: ${channel}`);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, handler);
    };
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string, handler?: MessageHandler): void {
    const handlers = this.subscriptions.get(channel);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    }

    if (!handler || handlers.size === 0) {
      this.subscriptions.delete(channel);
      this.sendUnsubscribe(channel);
      this.log(`Unsubscribed from channel: ${channel}`);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    for (const channel of this.subscriptions.keys()) {
      this.sendUnsubscribe(channel);
    }
    this.subscriptions.clear();
    this.log("Unsubscribed from all channels");
  }

  /**
   * Listen for connection state changes
   */
  onStateChange(handler: ConnectionStateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Listen for errors
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return this.config.clientId;
  }

  /**
   * Send subscribe message to server
   */
  private sendSubscribe(channel: string): void {
    const message: SubscribeMessage = {
      type: MessageType.SUBSCRIBE,
      channel,
      clientId: this.config.clientId,
      timestamp: Date.now(),
      id: `sub-${channel}-${Date.now()}`,
    };

    this.send(message);
  }

  /**
   * Send unsubscribe message to server
   */
  private sendUnsubscribe(channel: string): void {
    const message: UnsubscribeMessage = {
      type: MessageType.UNSUBSCRIBE,
      channel,
      clientId: this.config.clientId,
      timestamp: Date.now(),
      id: `unsub-${channel}-${Date.now()}`,
    };

    this.send(message);
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(data: string): void {
    try {
      const message: RealtimeMessage = JSON.parse(data);

      switch (message.type) {
        case "message":
          this.handleChannelMessage(message as ChannelMessage);
          break;

        case "pong":
          this.log("Received pong");
          break;

        case "ack":
          this.handleAck(message as AckMessage);
          break;

        case "error":
          this.log("Received error:", message);
          this.emitError(new Error((message as any).error));
          break;

        default:
          this.log("Unknown message type:", message.type);
      }
    } catch (error) {
      this.log("Error parsing message:", error);
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle channel message
   */
  private handleChannelMessage(message: ChannelMessage): void {
    const handlers = this.subscriptions.get(message.channel);
    if (!handlers) {
      this.log(`No handlers for channel: ${message.channel}`);
      return;
    }

    // Call all handlers for this channel
    for (const handler of handlers) {
      try {
        handler(message.event, message.data, message.metadata);
      } catch (error) {
        this.log("Error in message handler:", error);
        this.emitError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Send acknowledgment if required
    if (message.requiresAck && message.id) {
      this.sendAck(message.id, message.channel);
    }
  }

  /**
   * Handle acknowledgment message
   */
  private handleAck(message: AckMessage): void {
    this.log(`Received ack for message: ${message.messageId}`);
  }

  /**
   * Send acknowledgment
   */
  private sendAck(messageId: string, channel: string): void {
    const ackMessage: AckMessage = {
      type: MessageType.ACK,
      messageId,
      channel,
      timestamp: Date.now(),
    };

    this.send(ackMessage);
  }

  /**
   * Send message to server
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.log("Cannot send - not connected");
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.log(`State changed to: ${state}`);

      for (const handler of this.stateHandlers) {
        try {
          handler(state);
        } catch (error) {
          this.log("Error in state handler:", error);
        }
      }
    }
  }

  /**
   * Emit error to error handlers
   */
  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (err) {
        this.log("Error in error handler:", err);
      }
    }
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.setState(ConnectionState.RECONNECTING);

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPing(): void {
    this.stopPing();

    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const pingMessage: PingMessage = {
          type: MessageType.PING,
          timestamp: Date.now(),
        };
        this.send(pingMessage);
      }
    }, this.config.pingInterval);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log("[RealtimeClient]", ...args);
    }
  }
}
