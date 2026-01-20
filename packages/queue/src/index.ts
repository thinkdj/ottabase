/**
 * @ottabase/queue
 *
 * Minimal queue system for Cloudflare Workers
 * Laravel-inspired job dispatching with modular handler registration
 */

// Job dispatching
export {
  createJob,
  Dispatcher,
  createDispatcher,
  dispatch,
  dispatchBatch,
} from "./job";
export type { DispatcherConfig } from "./job";

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
  // New types
  JobPriority,
  ChainedJob,
  PriorityQueues,
  DedupeStore,
} from "./types";

// Adapter types (re-export for convenience)
export type {
  QueueAdapter,
  AdapterResult,
  SendOptions,
  QueueMessage,
  QueueMessageBatch,
} from "./adapters/types";
