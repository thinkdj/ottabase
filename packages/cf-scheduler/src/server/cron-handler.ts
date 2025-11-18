/**
 * Cloudflare Workers cron trigger handler
 * Integrates with Workers scheduled events
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { SchedulerConfig } from '../types';
import { createScheduler } from './scheduler';

export interface CronHandlerOptions extends SchedulerConfig {
  /**
   * D1 database instance
   */
  database: D1Database;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

/**
 * Create a cron handler for Cloudflare Workers
 *
 * Usage in wrangler.toml:
 *
 * [triggers]
 * crons = ["* * * * *"]  # Run every minute
 *
 * Usage in worker:
 *
 * export default {
 *   scheduled: createCronHandler({
 *     database: env.DB,
 *     handlers: {
 *       'send-email': async (payload) => {
 *         // Your task logic
 *       }
 *     }
 *   })
 * }
 */
export function createCronHandler(options: CronHandlerOptions) {
  return async (event: ScheduledEvent, env: unknown, ctx: ExecutionContext): Promise<void> => {
    const startTime = Date.now();

    try {
      const scheduler = createScheduler(options.database, {
        handlers: options.handlers,
        maxTasksPerRun: options.maxTasksPerRun,
        enableLogging: options.enableLogging,
      });

      if (options.verbose) {
        console.log('[Scheduler] Running scheduled tasks at', new Date().toISOString());
      }

      const results = await scheduler.runDueTasks();

      if (options.verbose) {
        console.log(`[Scheduler] Completed ${results.length} tasks in ${Date.now() - startTime}ms`);
        results.forEach((result, index) => {
          if (result.success) {
            console.log(`[Scheduler] Task ${index + 1}: Success (${result.executionTimeMs}ms)`);
          } else {
            console.error(`[Scheduler] Task ${index + 1}: Failed - ${result.error}`);
          }
        });
      }
    } catch (error) {
      console.error('[Scheduler] Cron execution failed:', error);
      throw error;
    }
  };
}

/**
 * Scheduled event type from Cloudflare Workers
 */
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

/**
 * Execution context from Cloudflare Workers
 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
