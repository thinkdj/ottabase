/**
 * Cloudflare Queues Adapter
 *
 * Adapter implementation for Cloudflare Queues.
 * This is the default adapter for the queue package.
 */

import { createQueuesClient } from "@ottabase/cf/queues";
import type { Queue } from "@cloudflare/workers-types";
import type { QueuedJob } from "../types";
import type {
  QueueAdapter,
  AdapterResult,
  SendOptions,
  QueueMessage,
  QueueMessageBatch,
} from "./types";

/**
 * Configuration for Cloudflare Queues adapter
 */
export interface CloudflareAdapterConfig {
  /** Cloudflare Queue binding from worker env */
  queue: Queue;
}

/**
 * Cloudflare Queues Adapter
 *
 * Wraps @ottabase/cf/queues to implement the QueueAdapter interface.
 */
export class CloudflareAdapter implements QueueAdapter {
  readonly name = "cloudflare";
  private client: ReturnType<typeof createQueuesClient<QueuedJob>>;

  constructor(config: CloudflareAdapterConfig) {
    this.client = createQueuesClient<QueuedJob>({ queue: config.queue });
  }

  /**
   * Send a single job to the Cloudflare Queue
   */
  async send(
    job: QueuedJob,
    options?: SendOptions
  ): Promise<AdapterResult<void>> {
    const result = await this.client.send(job, {
      delaySeconds: options?.delaySeconds,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: undefined };
  }

  /**
   * Send multiple jobs to the Cloudflare Queue in a batch
   */
  async sendBatch(
    messages: Array<{ body: QueuedJob; options?: SendOptions }>
  ): Promise<AdapterResult<void>> {
    const cfMessages = messages.map((m) => ({
      body: m.body,
      options: m.options?.delaySeconds
        ? { delaySeconds: m.options.delaySeconds }
        : undefined,
    }));

    const result = await this.client.sendBatch(cfMessages);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: undefined };
  }
}

/**
 * Create a Cloudflare Queues adapter
 *
 * @example
 * ```ts
 * const adapter = createCloudflareAdapter({ queue: env.MY_QUEUE });
 * const dispatcher = createDispatcher(adapter);
 * ```
 */
export function createCloudflareAdapter(
  config: CloudflareAdapterConfig
): CloudflareAdapter {
  return new CloudflareAdapter(config);
}

/**
 * Convert Cloudflare MessageBatch to adapter's QueueMessageBatch
 *
 * Use this in your worker's queue handler to convert CF's batch format
 * to the adapter's generic format.
 *
 * @example
 * ```ts
 * export default {
 *   async queue(batch: MessageBatch<QueuedJob>, env: Env) {
 *     const messages = toAdapterBatch(batch);
 *     await processor.process(messages, env);
 *   }
 * };
 * ```
 */
export function toAdapterBatch<T>(
  cfBatch: import("@cloudflare/workers-types").MessageBatch<T>
): QueueMessageBatch<T> {
  return {
    queue: cfBatch.queue,
    messages: cfBatch.messages.map((msg) => ({
      body: msg.body,
      attempts: msg.attempts,
      ack: () => msg.ack(),
      retry: () => msg.retry(),
    })),
  };
}

// Re-export CF types for convenience when using this adapter directly
export type { Queue } from "@cloudflare/workers-types";
