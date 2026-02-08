/**
 * Job Module
 * Create and dispatch jobs to queues using adapters
 */

import { createCloudflareAdapter } from './adapters/cloudflare';
import type { QueueAdapter } from './adapters/types';
import type {
    DedupeStore,
    DispatchOptions,
    JobMeta,
    JobPriority,
    PriorityQueues,
    Queue,
    QueueConfig,
    QueuedJob,
    QueueResult,
} from './types';

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a job payload ready for dispatch
 */
export function createJob<T = unknown>(type: string, payload: T, options?: DispatchOptions): QueuedJob<T> {
    const meta: JobMeta = {
        id: generateJobId(),
        dispatchedAt: Date.now(),
        attempts: 0,
    };

    if (options?.maxAttempts) {
        meta.maxAttempts = options.maxAttempts;
    }

    if (options?.tags) {
        meta.tags = options.tags;
    }

    if (options?.priority) {
        meta.priority = options.priority;
    }

    if (options?.then && options.then.length > 0) {
        meta.chain = options.then;
    }

    return {
        type,
        payload,
        meta,
    };
}

/**
 * Dispatcher configuration
 * Supports adapter-based, queue-based, and priority queue configs
 */
export type DispatcherConfig =
    | { adapter: QueueAdapter; dedupeStore?: DedupeStore }
    | { queue: Queue; dedupeStore?: DedupeStore }
    | { priorityQueues: PriorityQueues; defaultPriority?: JobPriority; dedupeStore?: DedupeStore };

/**
 * Queue dispatcher class
 * Handles sending jobs to a queue using an adapter
 */
export class Dispatcher {
    private adapter?: QueueAdapter;
    private priorityAdapters?: Record<JobPriority, QueueAdapter | undefined>;
    private defaultPriority: JobPriority = 'normal';
    private dedupeStore?: DedupeStore;

    constructor(config: DispatcherConfig) {
        this.dedupeStore = config.dedupeStore;

        if ('adapter' in config) {
            this.adapter = config.adapter;
        } else if ('queue' in config) {
            this.adapter = createCloudflareAdapter({ queue: config.queue });
        } else if ('priorityQueues' in config) {
            this.defaultPriority = config.defaultPriority ?? 'normal';
            this.priorityAdapters = {
                high: config.priorityQueues.high
                    ? createCloudflareAdapter({ queue: config.priorityQueues.high })
                    : undefined,
                normal: config.priorityQueues.normal
                    ? createCloudflareAdapter({ queue: config.priorityQueues.normal })
                    : undefined,
                low: config.priorityQueues.low
                    ? createCloudflareAdapter({ queue: config.priorityQueues.low })
                    : undefined,
            };
        }
    }

    /**
     * Get the appropriate adapter for a priority level
     */
    private getAdapterForPriority(priority?: JobPriority): QueueAdapter {
        if (this.adapter) {
            return this.adapter;
        }

        if (this.priorityAdapters) {
            const p = priority ?? this.defaultPriority;
            const adapter = this.priorityAdapters[p];
            if (adapter) return adapter;

            // Fallback: try normal, then any available
            if (this.priorityAdapters.normal) return this.priorityAdapters.normal;
            const fallback = Object.values(this.priorityAdapters).find((a) => a);
            if (fallback) return fallback;
        }

        throw new Error('No queue adapter configured');
    }

    /**
     * Check if a job should be deduplicated
     * Returns true if job is duplicate (should skip), false if unique (should dispatch)
     */
    private async isDuplicate(type: string, options?: DispatchOptions): Promise<boolean> {
        if (!this.dedupeStore || !options?.uniqueKey) {
            return false;
        }

        const key = `dedupe:${type}:${options.uniqueKey}`;
        const existing = await this.dedupeStore.get(key);

        if (existing) {
            return true; // Duplicate found
        }

        // Mark as seen with TTL
        const ttl = options.uniqueFor ?? 300; // Default 5 minutes
        await this.dedupeStore.put(key, Date.now().toString(), {
            expirationTtl: ttl,
        });

        return false;
    }

    /**
     * Dispatch a single job to the queue
     */
    async dispatch<T = unknown>(
        type: string,
        payload: T,
        options?: DispatchOptions,
    ): Promise<QueueResult<{ dispatched: boolean }>> {
        // Check deduplication
        if (await this.isDuplicate(type, options)) {
            return { success: true, data: { dispatched: false } };
        }

        const job = createJob(type, payload, options);
        const adapter = this.getAdapterForPriority(options?.priority);

        const result = await adapter.send(job, {
            delaySeconds: options?.delay,
        });

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return { success: true, data: { dispatched: true } };
    }

    /**
     * Dispatch multiple jobs in a batch
     */
    async dispatchBatch<T = unknown>(
        jobs: Array<{ type: string; payload: T; options?: DispatchOptions }>,
    ): Promise<QueueResult<{ count: number; dispatched: number }>> {
        // Group jobs by priority and filter duplicates
        const jobsByPriority: Record<JobPriority, Array<{ body: QueuedJob; options?: { delaySeconds?: number } }>> = {
            high: [],
            normal: [],
            low: [],
        };

        let skipped = 0;

        for (const j of jobs) {
            if (await this.isDuplicate(j.type, j.options)) {
                skipped++;
                continue;
            }

            const priority = j.options?.priority ?? this.defaultPriority;
            jobsByPriority[priority].push({
                body: createJob(j.type, j.payload, j.options),
                options: j.options?.delay ? { delaySeconds: j.options.delay } : undefined,
            });
        }

        // If using single adapter, send all together
        if (this.adapter) {
            const allJobs = [...jobsByPriority.high, ...jobsByPriority.normal, ...jobsByPriority.low];

            if (allJobs.length === 0) {
                return { success: true, data: { count: jobs.length, dispatched: 0 } };
            }

            const result = await this.adapter.sendBatch(allJobs);
            if (!result.success) {
                return { success: false, error: result.error };
            }

            return {
                success: true,
                data: { count: jobs.length, dispatched: allJobs.length },
            };
        }

        // Send to respective priority queues
        let dispatched = 0;
        for (const priority of ['high', 'normal', 'low'] as JobPriority[]) {
            const batch = jobsByPriority[priority];
            if (batch.length === 0) continue;

            const adapter = this.priorityAdapters?.[priority];
            if (!adapter) continue;

            const result = await adapter.sendBatch(batch);
            if (!result.success) {
                return { success: false, error: result.error };
            }

            dispatched += batch.length;
        }

        return { success: true, data: { count: jobs.length, dispatched } };
    }

    /**
     * Get the adapter instance (primary or for a specific priority)
     */
    getAdapter(priority?: JobPriority): QueueAdapter {
        return this.getAdapterForPriority(priority);
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
    queue: QueueConfig['queue'],
    type: string,
    payload: T,
    options?: DispatchOptions,
): Promise<QueueResult> {
    const dispatcher = createDispatcher({ queue });
    const result = await dispatcher.dispatch(type, payload, options);
    if (!result.success) return result;
    return { success: true, data: undefined };
}

/**
 * Convenience function: dispatch multiple jobs directly
 */
export async function dispatchBatch<T = unknown>(
    queue: QueueConfig['queue'],
    jobs: Array<{ type: string; payload: T; options?: DispatchOptions }>,
): Promise<QueueResult<{ count: number }>> {
    const dispatcher = createDispatcher({ queue });
    const result = await dispatcher.dispatchBatch(jobs);
    if (!result.success) return result;
    return { success: true, data: { count: result.data.dispatched } };
}
