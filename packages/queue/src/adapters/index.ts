/**
 * Queue Adapters
 *
 * This module exports adapter interfaces and implementations.
 * Use adapters to connect the queue system to different backends.
 *
 * @example Using Cloudflare Queues (default)
 * ```ts
 * import { createCloudflareAdapter } from "@ottabase/queue/adapters";
 *
 * const adapter = createCloudflareAdapter({ queue: env.MY_QUEUE });
 * const dispatcher = createDispatcher({ adapter });
 * ```
 *
 * @example Creating a custom adapter
 * ```ts
 * import { QueueAdapter, AdapterResult } from "@ottabase/queue/adapters";
 *
 * class RedisAdapter implements QueueAdapter {
 *   readonly name = "redis";
 *   async send(job, options) { ... }
 *   async sendBatch(messages) { ... }
 * }
 * ```
 */

// Adapter types
export type {
  QueueAdapter,
  AdapterResult,
  SendOptions,
  QueueMessage,
  QueueMessageBatch,
  AdapterConfig,
  AdapterFactory,
} from "./types";

// Cloudflare adapter
export {
  CloudflareAdapter,
  createCloudflareAdapter,
  toAdapterBatch,
} from "./cloudflare";
export type { CloudflareAdapterConfig } from "./cloudflare";
