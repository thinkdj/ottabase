/**
 * Cron Types
 * Core types for the cron handler system
 */

import type {
  ScheduledEvent,
  ExecutionContext,
} from "@cloudflare/workers-types";

/**
 * Context passed to cron job handlers
 */
export interface CronContext<E = unknown> {
  /** Worker environment bindings */
  env: E;
  /** The scheduled event from Cloudflare */
  event: ScheduledEvent;
  /** Execution context for waitUntil, etc. */
  ctx: ExecutionContext;
  /** Cron expression that triggered this job */
  cron: string;
  /** Scheduled time as Date object */
  scheduledTime: Date;
}

/**
 * Cron job handler function
 */
export type CronJobHandler<E = unknown> = (
  context: CronContext<E>
) => Promise<void> | void;

/**
 * Registered cron job entry
 */
export interface RegisteredCronJob<E = unknown> {
  /** Cron expression (e.g., "0 0 * * *") */
  cron: string;
  /** Handler function */
  handler: CronJobHandler<E>;
  /** Optional job name for logging */
  name?: string;
}

/**
 * Options for the cron handler
 */
export interface CronHandlerOptions<E = unknown> {
  /** Called when a job fails */
  onError?: (error: Error, context: CronContext<E>) => Promise<void> | void;
  /** Called before each job runs */
  onBeforeJob?: (context: CronContext<E>) => Promise<void> | void;
  /** Called after each job completes successfully */
  onAfterJob?: (context: CronContext<E>) => Promise<void> | void;
}

/**
 * The scheduled event handler signature expected by Cloudflare Workers
 */
export type ScheduledHandler<E = unknown> = (
  event: ScheduledEvent,
  env: E,
  ctx: ExecutionContext
) => Promise<void> | void;

// Re-export Cloudflare types for convenience
export type { ScheduledEvent, ExecutionContext };
