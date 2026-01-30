/**
 * Queue Processor
 * Process queue messages and route to registered handlers
 */

import type {
    QueuedJob,
    JobHandler,
    JobContext,
    RegisteredHandler,
    HandlerOptions,
    ProcessorOptions,
    MessageBatch,
    Message,
    ChainedJob,
    Queue,
    PriorityQueues,
} from './types';
import type { QueueMessage, QueueMessageBatch } from './adapters/types';
import { createCloudflareAdapter } from './adapters/cloudflare';

/**
 * Job handler registry
 * Stores handlers keyed by job type
 */
export class HandlerRegistry<E = unknown> {
    private handlers = new Map<string, RegisteredHandler<E>>();
    private defaultHandler?: JobHandler<unknown, E>;

    /**
     * Register a handler for a specific job type
     */
    register<T = unknown>(type: string, handler: JobHandler<T, E>, options?: HandlerOptions): this {
        this.handlers.set(type, {
            handler: handler as JobHandler<unknown, E>,
            options,
        });
        return this;
    }

    /**
     * Register a default handler for unknown job types
     */
    setDefault(handler: JobHandler<unknown, E>): this {
        this.defaultHandler = handler;
        return this;
    }

    /**
     * Get handler for a job type
     */
    get(type: string): RegisteredHandler<E> | undefined {
        return this.handlers.get(type);
    }

    /**
     * Get the default handler
     */
    getDefault(): JobHandler<unknown, E> | undefined {
        return this.defaultHandler;
    }

    /**
     * Check if a handler exists for a job type
     */
    has(type: string): boolean {
        return this.handlers.has(type);
    }

    /**
     * List all registered job types
     */
    types(): string[] {
        return Array.from(this.handlers.keys());
    }
}

/**
 * Create a new handler registry
 */
export function createRegistry<E = unknown>(): HandlerRegistry<E> {
    return new HandlerRegistry<E>();
}

/**
 * Normalized message interface (works with both CF and adapter messages)
 */
interface NormalizedMessage {
    body: QueuedJob;
    attempts: number;
    ack: () => void;
    retry: () => void;
}

/**
 * Queue Processor
 * Processes incoming queue batches using registered handlers
 */
export class QueueProcessor<E = unknown> {
    private registry: HandlerRegistry<E>;
    private options: ProcessorOptions<E>;

    constructor(registry: HandlerRegistry<E>, options: ProcessorOptions<E> = {}) {
        this.registry = registry;
        this.options = options;
    }

    /**
     * Process a batch of queue messages (Cloudflare MessageBatch)
     * This is the main entry point for the Cloudflare Worker queue handler
     */
    async process(batch: MessageBatch<QueuedJob>, env: E): Promise<void> {
        const results = await Promise.allSettled(batch.messages.map((message) => this.processMessage(message, env)));

        this.logFailures(results, batch.messages.length);
    }

    /**
     * Process a batch using adapter's generic message format
     * Use this when working with adapters other than Cloudflare
     */
    async processAdapterBatch(batch: QueueMessageBatch<QueuedJob>, env: E): Promise<void> {
        const results = await Promise.allSettled(
            batch.messages.map((message) => this.processAdapterMessage(message, env)),
        );

        this.logFailures(results, batch.messages.length);
    }

    private logFailures(results: PromiseSettledResult<void>[], total: number): void {
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

        if (failures.length > 0) {
            console.error(
                `[Queue] ${failures.length}/${total} messages failed:`,
                failures.map((f) => f.reason),
            );
        }
    }

    /**
     * Process a single Cloudflare message
     */
    private async processMessage(message: Message<QueuedJob>, env: E): Promise<void> {
        return this.processNormalizedMessage(
            {
                body: message.body,
                attempts: message.attempts,
                ack: () => message.ack(),
                retry: () => message.retry(),
            },
            env,
            message, // Pass original for JobContext
        );
    }

    /**
     * Process a single adapter message
     */
    private async processAdapterMessage(message: QueueMessage<QueuedJob>, env: E): Promise<void> {
        return this.processNormalizedMessage(
            {
                body: message.body,
                attempts: message.attempts,
                ack: () => message.ack(),
                retry: () => message.retry(),
            },
            env,
            undefined, // No original CF message for adapter messages
        );
    }

    /**
     * Dispatch chained jobs after successful processing
     */
    private async dispatchChainedJobs(chainedJobs: ChainedJob[], env: E): Promise<void> {
        const queue = this.options.chainQueue;
        const priorityQueues = this.options.chainPriorityQueues;

        if (!queue && !priorityQueues) {
            console.warn('[Queue] Job has chained jobs but no chainQueue configured, skipping chain dispatch');
            return;
        }

        for (const chainedJob of chainedJobs) {
            try {
                // Determine which queue to use based on priority
                let targetQueue: Queue | undefined = queue;

                if (priorityQueues) {
                    // For chained jobs, we don't have priority info, so use normal queue
                    targetQueue = priorityQueues.normal ?? queue;
                }

                if (!targetQueue) {
                    console.warn(`[Queue] No queue available for chained job: ${chainedJob.type}`);
                    continue;
                }

                const adapter = createCloudflareAdapter({ queue: targetQueue });

                const job: QueuedJob = {
                    type: chainedJob.type,
                    payload: chainedJob.payload,
                    meta: {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                        dispatchedAt: new Date().toISOString(),
                        attempts: 0,
                    },
                };

                await adapter.send(job, {
                    delaySeconds: chainedJob.delay,
                });

                console.log(`[Queue] Dispatched chained job: ${chainedJob.type}`);
            } catch (error) {
                console.error(`[Queue] Failed to dispatch chained job ${chainedJob.type}:`, error);
            }
        }
    }

    /**
     * Process a normalized message
     */
    private async processNormalizedMessage(
        message: NormalizedMessage,
        env: E,
        originalMessage?: Message<QueuedJob>,
    ): Promise<void> {
        const job = message.body;

        // Validate job structure
        if (!job || typeof job.type !== 'string') {
            console.error('[Queue] Invalid job structure, acking to remove:', job);
            message.ack();
            return;
        }

        // Get handler
        const registered = this.registry.get(job.type);
        const handler = registered?.handler ?? this.registry.getDefault();

        if (!handler) {
            console.warn(`[Queue] No handler registered for job type: ${job.type}`);
            message.ack(); // Ack to prevent infinite retries
            return;
        }

        // Track if handler explicitly called ack/retry
        let handled = false;

        // Create context with tracked ack/retry
        const ctx: JobContext<E> = {
            message: originalMessage ?? (message as unknown as Message<QueuedJob>),
            env,
            attempt: message.attempts,
            ack: () => {
                handled = true;
                message.ack();
            },
            retry: () => {
                handled = true;
                message.retry();
            },
        };

        try {
            // Before hook
            if (this.options.onBeforeProcess) {
                await this.options.onBeforeProcess(job, env);
            }

            // Execute handler
            await handler(job, ctx);

            // After hook
            if (this.options.onAfterProcess) {
                await this.options.onAfterProcess(job, env);
            }

            // Dispatch chained jobs on success (only if not retrying)
            if (!handled && job.meta?.chain && job.meta.chain.length > 0) {
                await this.dispatchChainedJobs(job.meta.chain, env);
            }

            // Auto-ack only if handler didn't explicitly call ack/retry
            if (!handled) {
                message.ack();
            }
        } catch (error) {
            const maxAttempts = registered?.options?.maxAttempts ?? job.meta?.maxAttempts ?? 3;

            if (message.attempts >= maxAttempts) {
                // Max retries reached
                console.error(`[Queue] Job ${job.type} failed after ${message.attempts} attempts:`, error);

                if (this.options.onFailure) {
                    await this.options.onFailure(job, error instanceof Error ? error : new Error(String(error)), env);
                }

                message.ack(); // Remove from queue
            } else {
                // Retry
                console.warn(
                    `[Queue] Job ${job.type} failed (attempt ${message.attempts}/${maxAttempts}), retrying:`,
                    error,
                );
                message.retry();
            }
        }
    }
}

/**
 * Create a queue processor
 */
export function createProcessor<E = unknown>(
    registry: HandlerRegistry<E>,
    options?: ProcessorOptions<E>,
): QueueProcessor<E> {
    return new QueueProcessor(registry, options);
}

/**
 * Create a queue handler function for Cloudflare Workers
 * This is the function you export as `queue` in your worker
 *
 * @example
 * ```ts
 * const registry = createRegistry<Env>()
 *   .register("send-email", sendEmailHandler)
 *   .register("process-order", processOrderHandler);
 *
 * export default {
 *   fetch: handleFetch,
 *   queue: createQueueHandler(registry),
 * };
 * ```
 */
export function createQueueHandler<E = unknown>(
    registry: HandlerRegistry<E>,
    options?: ProcessorOptions<E>,
): (batch: MessageBatch<QueuedJob>, env: E) => Promise<void> {
    const processor = createProcessor(registry, options);
    return (batch, env) => processor.process(batch, env);
}
