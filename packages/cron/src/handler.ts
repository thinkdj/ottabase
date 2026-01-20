/**
 * Cron Handler
 * Builder pattern for registering and executing cron jobs
 */

import type {
  CronContext,
  CronJobHandler,
  CronHandlerOptions,
  RegisteredCronJob,
  ScheduledHandler,
  ScheduledEvent,
  ExecutionContext,
} from "./types";

/**
 * Cron handler builder with chainable API
 */
export class CronHandler<E = unknown> {
  private jobs: RegisteredCronJob<E>[] = [];
  private options: CronHandlerOptions<E>;

  constructor(options: CronHandlerOptions<E> = {}) {
    this.options = options;
  }

  /**
   * Register a handler for a specific cron expression
   * @param cron - Cron expression (e.g., "0 0 * * *" for daily at midnight)
   * @param handler - Handler function to execute
   * @param name - Optional name for logging
   */
  on(
    cron: string,
    handler: CronJobHandler<E>,
    name?: string
  ): this {
    this.jobs.push({ cron, handler, name });
    return this;
  }

  /**
   * Get the scheduled event handler for Cloudflare Workers
   */
  get handler(): ScheduledHandler<E> {
    return async (
      event: ScheduledEvent,
      env: E,
      ctx: ExecutionContext
    ): Promise<void> => {
      const context: CronContext<E> = {
        env,
        event,
        ctx,
        cron: event.cron,
        scheduledTime: new Date(event.scheduledTime),
      };

      // Find matching jobs for this cron expression
      const matchingJobs = this.jobs.filter((job) => job.cron === event.cron);

      if (matchingJobs.length === 0) {
        console.warn(`[cron] No handler registered for: ${event.cron}`);
        return;
      }

      // Execute all matching handlers
      for (const job of matchingJobs) {
        try {
          // Before hook
          if (this.options.onBeforeJob) {
            await this.options.onBeforeJob(context);
          }

          // Execute handler
          await job.handler(context);

          // After hook
          if (this.options.onAfterJob) {
            await this.options.onAfterJob(context);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(
            `[cron] Error in job "${job.name || job.cron}":`,
            err.message
          );

          // Error hook
          if (this.options.onError) {
            await this.options.onError(err, context);
          } else {
            throw err;
          }
        }
      }
    };
  }

  /**
   * Get all registered jobs (useful for debugging/testing)
   */
  getJobs(): ReadonlyArray<RegisteredCronJob<E>> {
    return [...this.jobs];
  }
}

/**
 * Create a new cron handler builder
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * const cron = createCronHandler<Env>()
 *   .on("0 0 * * *", async ({ env }) => {
 *     await cleanupSessions(env.DB);
 *   })
 *   .on("0 * * * *", async ({ env }) => {
 *     await sendHourlyDigest(env);
 *   });
 *
 * export default {
 *   scheduled: cron.handler
 * };
 * ```
 */
export function createCronHandler<E = unknown>(
  options?: CronHandlerOptions<E>
): CronHandler<E> {
  return new CronHandler<E>(options);
}
