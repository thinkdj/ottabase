/**
 * @ottabase/queue
 *
 * Minimal queue system for Cloudflare Workers
 * Laravel-inspired job dispatching with modular handler registration
 *
 * @example Dispatching jobs
 * ```ts
 * import { dispatch, createDispatcher } from "@ottabase/queue";
 *
 * // Quick dispatch
 * await dispatch(env.MY_QUEUE, "send-email", {
 *   to: "user@example.com",
 *   subject: "Welcome!",
 * });
 *
 * // With options
 * await dispatch(env.MY_QUEUE, "process-order", { orderId: 123 }, {
 *   delay: 60, // Process after 60 seconds
 *   maxAttempts: 5,
 * });
 *
 * // Batch dispatch
 * const dispatcher = createDispatcher({ queue: env.MY_QUEUE });
 * await dispatcher.dispatchBatch([
 *   { type: "notify-user", payload: { userId: 1 } },
 *   { type: "notify-user", payload: { userId: 2 } },
 * ]);
 * ```
 *
 * @example Processing jobs
 * ```ts
 * import { createRegistry, createQueueHandler } from "@ottabase/queue/processor";
 *
 * // Create registry with handlers
 * const registry = createRegistry<Env>()
 *   .register("send-email", async (job, ctx) => {
 *     const { to, subject, body } = job.payload;
 *     await sendEmail(to, subject, body);
 *   })
 *   .register("process-order", async (job, ctx) => {
 *     const { orderId } = job.payload;
 *     await processOrder(orderId, ctx.env.DB);
 *   });
 *
 * // Export in worker
 * export default {
 *   fetch: handleRequest,
 *   queue: createQueueHandler(registry),
 * };
 * ```
 */

// Job dispatching
export {
  createJob,
  Dispatcher,
  createDispatcher,
  dispatch,
  dispatchBatch,
} from "./job";

// Queue processing
export {
  HandlerRegistry,
  createRegistry,
  QueueProcessor,
  createProcessor,
  createQueueHandler,
} from "./processor";

// Types
export type {
  QueuedJob,
  JobMeta,
  DispatchOptions,
  QueueConfig,
  JobHandler,
  JobContext,
  QueueResult,
  RegisteredHandler,
  HandlerOptions,
  ProcessorOptions,
  Queue,
  MessageBatch,
  Message,
} from "./types";
