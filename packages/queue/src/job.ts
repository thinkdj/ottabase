/**
 * Job Module
 * Create and dispatch jobs to queues using adapters
 */

import type {
  QueuedJob,
  DispatchOptions,
  QueueConfig,
  QueueResult,
  JobMeta,
} from "./types";
import type { QueueAdapter } from "./adapters/types";
import { createCloudflareAdapter } from "./adapters/cloudflare";

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a job payload ready for dispatch
 */
export function createJob<T = unknown>(
  type: string,
  payload: T,
  options?: DispatchOptions
): QueuedJob<T> {
  const meta: JobMeta = {
    id: generateJobId(),
    dispatchedAt: new Date().toISOString(),
    attempts: 0,
  };

  if (options?.maxAttempts) {
    meta.maxAttempts = options.maxAttempts;
  }

  if (options?.tags) {
    meta.tags = options.tags;
  }

  return {
    type,
    payload,
    meta,
  };
}

/**
 * Dispatcher configuration
 * Supports both adapter-based and legacy queue-based config
 */
export type DispatcherConfig =
  | { adapter: QueueAdapter }
  | QueueConfig;

/**
 * Queue dispatcher class
 * Handles sending jobs to a queue using an adapter
 */
export class Dispatcher {
  private adapter: QueueAdapter;

  constructor(config: DispatcherConfig) {
    if ("adapter" in config) {
      this.adapter = config.adapter;
    } else {
      // Backwards compatibility: create CloudflareAdapter from queue binding
      this.adapter = createCloudflareAdapter({ queue: config.queue });
    }
  }

  /**
   * Dispatch a single job to the queue
   */
  async dispatch<T = unknown>(
    type: string,
    payload: T,
    options?: DispatchOptions
  ): Promise<QueueResult> {
    const job = createJob(type, payload, options);

    const result = await this.adapter.send(job, {
      delaySeconds: options?.delay,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: undefined };
  }

  /**
   * Dispatch multiple jobs in a batch
   */
  async dispatchBatch<T = unknown>(
    jobs: Array<{ type: string; payload: T; options?: DispatchOptions }>
  ): Promise<QueueResult<{ count: number }>> {
    const queuedJobs = jobs.map((j) => ({
      body: createJob(j.type, j.payload, j.options),
      options: j.options?.delay ? { delaySeconds: j.options.delay } : undefined,
    }));

    const result = await this.adapter.sendBatch(queuedJobs);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: { count: jobs.length } };
  }

  /**
   * Get the adapter instance
   */
  getAdapter(): QueueAdapter {
    return this.adapter;
  }
}

/**
 * Create a dispatcher instance
 */
export function createDispatcher(config: DispatcherConfig): Dispatcher {
  return new Dispatcher(config);
}

/**
 * Convenience function: dispatch a job directly
 * Creates a dispatcher and dispatches in one call
 */
export async function dispatch<T = unknown>(
  queue: QueueConfig["queue"],
  type: string,
  payload: T,
  options?: DispatchOptions
): Promise<QueueResult> {
  const dispatcher = createDispatcher({ queue });
  return dispatcher.dispatch(type, payload, options);
}

/**
 * Convenience function: dispatch multiple jobs directly
 */
export async function dispatchBatch<T = unknown>(
  queue: QueueConfig["queue"],
  jobs: Array<{ type: string; payload: T; options?: DispatchOptions }>
): Promise<QueueResult<{ count: number }>> {
  const dispatcher = createDispatcher({ queue });
  return dispatcher.dispatchBatch(jobs);
}
