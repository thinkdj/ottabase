/**
 * Queues wrapper
 * Type-safe wrapper for Cloudflare Queues
 *
 * @see https://developers.cloudflare.com/queues/
 */

import type { Queue, MessageBatch, Message } from '@cloudflare/workers-types';
import { CloudflareError, type Result } from './types';

export interface QueuesConfig {
  queue: Queue;
}

export interface QueueSendOptions {
  /**
   * Delay in seconds before the message is delivered (0-43200 seconds / 12 hours)
   */
  delaySeconds?: number;

  /**
   * Content type of the message body
   */
  contentType?: string;
}

export interface QueueMessage<T = unknown> {
  id: string;
  timestamp: Date;
  body: T;
  attempts: number;
}

/**
 * Type-safe Queues wrapper
 */
export class QueuesClient<T = unknown> {
  private queue: Queue<T>;

  constructor(config: QueuesConfig) {
    if (!config.queue) {
      throw new CloudflareError(
        'Queue binding is required',
        'QUEUE_MISSING_BINDING'
      );
    }
    this.queue = config.queue as Queue<T>;
  }

  /**
   * Send a message to the queue
   */
  async send(body: T, options?: QueueSendOptions): Promise<Result<void, Error>> {
    try {
      await this.queue.send(body, options as any);

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Send multiple messages to the queue in a batch
   */
  async sendBatch(
    messages: Array<{ body: T; options?: QueueSendOptions }>
  ): Promise<Result<void, Error>> {
    try {
      const messagesToSend = messages.map((msg) => ({
        body: msg.body,
        ...(msg.options || {}),
      }));

      await this.queue.sendBatch(messagesToSend as any);

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get raw Queue instance for advanced usage
   */
  getRaw(): Queue<T> {
    return this.queue;
  }
}

/**
 * Queue consumer handler type
 */
export type QueueHandler<T = unknown> = (
  batch: MessageBatch<T>,
  env: unknown
) => Promise<void> | void;

/**
 * Helper to process queue messages with error handling
 */
export async function processQueueBatch<T = unknown>(
  batch: MessageBatch<T>,
  handler: (message: Message<T>) => Promise<void>
): Promise<Result<void, Error>> {
  try {
    const promises = batch.messages.map(async (message) => {
      try {
        await handler(message);
        message.ack();
      } catch (error) {
        message.retry();
        throw error;
      }
    });

    await Promise.all(promises);

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Create a Queues client instance
 */
export function createQueuesClient<T = unknown>(config: QueuesConfig): QueuesClient<T> {
  return new QueuesClient<T>(config);
}
