/**
 * Core types for cf-realtime pub/sub system
 */

/**
 * Message types that can be sent through the system
 */
export enum MessageType {
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",
  MESSAGE = "message",
  BROADCAST = "broadcast",
  ERROR = "error",
  ACK = "ack",
  PING = "ping",
  PONG = "pong",
}

/**
 * Base message structure
 */
export interface BaseMessage {
  type: MessageType;
  timestamp: number;
  id?: string;
}

/**
 * Subscribe to a channel
 */
export interface SubscribeMessage extends BaseMessage {
  type: MessageType.SUBSCRIBE;
  channel: string;
  clientId: string;
}

/**
 * Unsubscribe from a channel
 */
export interface UnsubscribeMessage extends BaseMessage {
  type: MessageType.UNSUBSCRIBE;
  channel: string;
  clientId: string;
}

/**
 * Regular message sent to a channel
 */
export interface ChannelMessage extends BaseMessage {
  type: MessageType.MESSAGE;
  channel: string;
  event: string;
  data: any;
  metadata?: Record<string, any>;
  requiresAck?: boolean; // For offline delivery
}

/**
 * Broadcast message to all subscribers
 */
export interface BroadcastMessage extends BaseMessage {
  type: MessageType.BROADCAST;
  channels: string[];
  event: string;
  data: any;
  metadata?: Record<string, any>;
  persistForOffline?: boolean; // Queue for offline clients
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  error: string;
  details?: any;
}

/**
 * Acknowledgment message
 */
export interface AckMessage extends BaseMessage {
  type: MessageType.ACK;
  messageId: string;
  channel: string;
}

/**
 * Ping message
 */
export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
}

/**
 * Pong message
 */
export interface PongMessage extends BaseMessage {
  type: MessageType.PONG;
}

/**
 * Union type of all messages
 */
export type RealtimeMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | ChannelMessage
  | BroadcastMessage
  | ErrorMessage
  | AckMessage
  | PingMessage
  | PongMessage;

/**
 * Connection state
 */
export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

/**
 * Client connection info
 */
export interface ClientConnection {
  clientId: string;
  channels: Set<string>;
  connectedAt: number;
  lastSeenAt: number;
  metadata?: Record<string, any>;
}

/**
 * Offline message stored for later delivery
 */
export interface OfflineMessage {
  id: string;
  channel: string;
  event: string;
  data: any;
  metadata?: Record<string, any>;
  createdAt: number;
  expiresAt?: number;
  delivered?: boolean;
}

/**
 * Channel statistics
 */
export interface ChannelStats {
  channel: string;
  subscriberCount: number;
  messageCount: number;
  lastActivityAt: number;
}

/**
 * Server-side broadcast options
 */
export interface BroadcastOptions {
  channels: string[];
  event: string;
  data: any;
  metadata?: Record<string, any>;
  persistForOffline?: boolean;
  ttl?: number; // Time to live for offline messages in seconds
}

/**
 * Client configuration
 */
export interface ClientConfig {
  url: string;
  clientId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  debug?: boolean;
}

/**
 * Server configuration (for Actor)
 */
export interface ServerConfig {
  maxConnectionsPerChannel?: number;
  offlineMessageTTL?: number; // Default TTL in seconds
  maxOfflineMessages?: number;
  enablePersistence?: boolean;
}

/**
 * Event handler types
 */
export type MessageHandler = (event: string, data: any, metadata?: Record<string, any>) => void;
export type ConnectionStateHandler = (state: ConnectionState) => void;
export type ErrorHandler = (error: Error) => void;
