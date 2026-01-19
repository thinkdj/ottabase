/**
 * Job Module
 * Create and dispatch jobs to Cloudflare Queues
 */

import { createQueuesClient } from "@ottabase/cf/queues";
import type {
  QueuedJob,
  DispatchOptions,
  QueueConfig,
  QueueResult,
  JobMeta,
} from "./types";

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
 * Queue dispatcher class
 * Handles sending jobs to a Cloudflare Queue
 */
export class Dispatcher {
  private queueClient: ReturnType<typeof createQueuesClient<QueuedJob>>;

  constructor(config: QueueConfig) {
    this.queueClient = createQueuesClient<QueuedJob>({ queue: config.queue });
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

    const result = await this.queueClient.send(job, {
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

    const result = await this.queueClient.sendBatch(queuedJobs);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: { count: jobs.length } };
  }

  /**
   * Get the raw queue client for advanced usage
   */
  getRawClient() {
    return this.queueClient;
  }
}

/**
 * Create a dispatcher instance
 */
export function createDispatcher(config: QueueConfig): Dispatcher {
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
