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
} from "./types";

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
  register<T = unknown>(
    type: string,
    handler: JobHandler<T, E>,
    options?: HandlerOptions
  ): this {
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
   * Process a batch of queue messages
   * This is the main entry point for the Cloudflare Worker queue handler
   */
  async process(batch: MessageBatch<QueuedJob>, env: E): Promise<void> {
    const results = await Promise.allSettled(
      batch.messages.map((message) => this.processMessage(message, env))
    );

    // Log any failures (but don't throw - let individual message handling decide retry/ack)
    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );

    if (failures.length > 0) {
      console.error(
        `[Queue] ${failures.length}/${batch.messages.length} messages failed:`,
        failures.map((f) => f.reason)
      );
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    message: Message<QueuedJob>,
    env: E
  ): Promise<void> {
    const job = message.body;

    // Validate job structure
    if (!job || typeof job.type !== "string") {
      console.error("[Queue] Invalid job structure, acking to remove:", job);
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

    // Create context
    const ctx: JobContext<E> = {
      message,
      env,
      attempt: message.attempts,
      ack: () => message.ack(),
      retry: () => message.retry(),
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

      // Auto-ack if not already acked/retried
      message.ack();
    } catch (error) {
      const maxAttempts =
        registered?.options?.maxAttempts ?? job.meta?.maxAttempts ?? 3;

      if (message.attempts >= maxAttempts) {
        // Max retries reached
        console.error(
          `[Queue] Job ${job.type} failed after ${message.attempts} attempts:`,
          error
        );

        if (this.options.onFailure) {
          await this.options.onFailure(
            job,
            error instanceof Error ? error : new Error(String(error)),
            env
          );
        }

        message.ack(); // Remove from queue
      } else {
        // Retry
        console.warn(
          `[Queue] Job ${job.type} failed (attempt ${message.attempts}/${maxAttempts}), retrying:`,
          error
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
  options?: ProcessorOptions<E>
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
  options?: ProcessorOptions<E>
): (batch: MessageBatch<QueuedJob>, env: E) => Promise<void> {
  const processor = createProcessor(registry, options);
  return (batch, env) => processor.process(batch, env);
}
