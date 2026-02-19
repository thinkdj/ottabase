/**
 * Queue Adapter Types
 *
 * Defines the interface for queue backend adapters.
 * Implement this interface to add support for different queue systems
 * (Cloudflare Queues, Redis/BullMQ, AWS SQS, etc.)
 */

import type { QueuedJob } from '../types';

/**
 * Result type for adapter operations
 */
export type AdapterResult<T = void> = { success: true; data: T } | { success: false; error: Error };

/**
 * Options for sending a message
 */
export interface SendOptions {
    /** Delay in seconds before the message is available for processing */
    delaySeconds?: number;
}

/**
 * A message received from the queue for processing
 */
export interface QueueMessage<T = unknown> {
    /** The message body/payload */
    body: T;
    /** Number of times this message has been attempted */
    attempts: number;
    /** Acknowledge the message (mark as processed) */
    ack(): void;
    /** Retry the message (return to queue for reprocessing) */
    retry(): void;
}

/**
 * A batch of messages received from the queue
 */
export interface QueueMessageBatch<T = unknown> {
    /** The messages in this batch */
    messages: QueueMessage<T>[];
    /** Queue identifier (for logging/debugging) */
    queue: string;
}

/**
 * Queue Adapter Interface
 *
 * Implement this interface to add support for a new queue backend.
 *
 * @example
 * ```ts
 * class RedisAdapter implements QueueAdapter {
 *   async send(job: QueuedJob, options?: SendOptions) {
 *     // Add job to Redis queue (e.g., using BullMQ)
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface QueueAdapter {
    /** Adapter name for logging/debugging */
    readonly name: string;

    /**
     * Send a single job to the queue
     */
    send(job: QueuedJob, options?: SendOptions): Promise<AdapterResult<void>>;

    /**
     * Send multiple jobs to the queue in a batch
     */
    sendBatch(messages: Array<{ body: QueuedJob; options?: SendOptions }>): Promise<AdapterResult<void>>;
}

/**
 * Configuration for creating an adapter
 */
export interface AdapterConfig {
    /** Adapter-specific configuration */
    [key: string]: unknown;
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory<C extends AdapterConfig = AdapterConfig> = (config: C) => QueueAdapter;
