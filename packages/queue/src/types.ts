/**
 * Queue Types
 * Core types for the queue system
 */

import type { Queue, MessageBatch, Message } from "@cloudflare/workers-types";

/**
 * Represents a queued job payload
 */
export interface QueuedJob<T = unknown> {
  /** Unique job type identifier (e.g., "send-email", "process-order") */
  type: string;
  /** The job payload data */
  payload: T;
  /** Metadata about the job */
  meta?: JobMeta;
}

/**
 * Job metadata
 */
export interface JobMeta {
  /** Unique job ID (auto-generated if not provided) */
  id?: string;
  /** When the job was dispatched */
  dispatchedAt?: string;
  /** Number of retry attempts */
  attempts?: number;
  /** Maximum retry attempts before failing */
  maxAttempts?: number;
  /** Custom tags for filtering/tracking */
  tags?: string[];
}

/**
 * Options for dispatching a job
 */
export interface DispatchOptions {
  /** Delay in seconds before processing (0-43200, max 12 hours) */
  delay?: number;
  /** Maximum retry attempts */
  maxAttempts?: number;
  /** Custom tags for filtering/tracking */
  tags?: string[];
}

/**
 * Configuration for the queue dispatcher
 */
export interface QueueConfig {
  /** Cloudflare Queue binding */
  queue: Queue;
}

/**
 * Job handler function type
 */
export type JobHandler<T = unknown, E = unknown> = (
  job: QueuedJob<T>,
  ctx: JobContext<E>
) => Promise<void> | void;

/**
 * Context passed to job handlers
 */
export interface JobContext<E = unknown> {
  /** The raw Cloudflare message */
  message: Message<QueuedJob>;
  /** Worker environment bindings */
  env: E;
  /** Current attempt number */
  attempt: number;
  /** Mark the job as complete */
  ack: () => void;
  /** Retry the job */
  retry: () => void;
}

/**
 * Result type for queue operations
 */
export type QueueResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Registered handler entry
 */
export interface RegisteredHandler<E = unknown> {
  handler: JobHandler<unknown, E>;
  options?: HandlerOptions;
}

/**
 * Options for handler registration
 */
export interface HandlerOptions {
  /** Maximum retry attempts for this handler */
  maxAttempts?: number;
}

/**
 * Processor options
 * Note: env parameter is optional in callbacks for flexibility
 */
export interface ProcessorOptions<E = unknown> {
  /** Called when a job fails all retries */
  onFailure?: (job: QueuedJob, error: Error, env?: E) => Promise<void> | void;
  /** Called before processing each job */
  onBeforeProcess?: (job: QueuedJob, env?: E) => Promise<void> | void;
  /** Called after successfully processing each job */
  onAfterProcess?: (job: QueuedJob, env?: E) => Promise<void> | void;
}

// Re-export Cloudflare types for convenience
export type { Queue, MessageBatch, Message };
