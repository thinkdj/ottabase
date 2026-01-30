/**
 * Queue Types
 * Core types for the queue system
 */

import type { Queue, MessageBatch, Message } from '@cloudflare/workers-types';

/**
 * Job priority levels
 */
export type JobPriority = 'high' | 'normal' | 'low';

/**
 * Chained job definition - jobs to dispatch after current job succeeds
 */
export interface ChainedJob<T = unknown> {
    type: string;
    payload: T;
    /** Delay in seconds before processing the chained job */
    delay?: number;
}

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
    /** Jobs to dispatch after this job succeeds */
    chain?: ChainedJob[];
    /** Priority level */
    priority?: JobPriority;
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
    /** Job priority (requires priority queues configured) */
    priority?: JobPriority;

    // Deduplication options
    /** Unique key for deduplication (combined with job type) */
    uniqueKey?: string;
    /** Time window in seconds for deduplication (default: 300 = 5 min) */
    uniqueFor?: number;

    // Job chaining
    /** Jobs to dispatch after this job succeeds */
    then?: ChainedJob[];
}

/**
 * Configuration for the queue dispatcher
 */
export interface QueueConfig {
    /** Cloudflare Queue binding */
    queue: Queue;
}

/**
 * Priority queue configuration
 */
export interface PriorityQueues {
    high?: Queue;
    normal?: Queue;
    low?: Queue;
}

/**
 * KV namespace interface for deduplication
 */
export interface DedupeStore {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Job handler function type
 */
export type JobHandler<T = unknown, E = unknown> = (job: QueuedJob<T>, ctx: JobContext<E>) => Promise<void> | void;

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
export type QueueResult<T = void> = { success: true; data: T } | { success: false; error: Error };

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
    /** Queue for dispatching chained jobs (required for job chaining) */
    chainQueue?: Queue;
    /** Priority queues for chained jobs */
    chainPriorityQueues?: PriorityQueues;
}

// Re-export Cloudflare types for convenience
export type { Queue, MessageBatch, Message };
