/**
 * @ottabase/cron
 *
 * Minimal cron handler for Cloudflare Workers scheduled events
 * Simple, focused package for running scheduled tasks
 */

// Static Cron Handler (code-defined jobs)
export { CronHandler, createCronHandler } from "./handler";

// DB-driven Scheduler (like Laravel's scheduler)
export {
  Scheduler,
  createScheduler,
  createTaskRepository,
} from "./scheduler";

// Cron Parser utilities
export {
  parseCron,
  matchesCron,
  getNextRun,
  CronPresets,
} from "./cron-parser";

// Types - Handler
export type {
  CronContext,
  CronJobHandler,
  CronHandlerOptions,
  RegisteredCronJob,
  ScheduledHandler,
  ScheduledEvent,
  ExecutionContext,
} from "./types";

// Types - Scheduler
export type {
  SchedulerContext,
  TaskHandler,
  SchedulerOptions,
  RegisteredHandler,
  ScheduledTaskRecord,
  TaskRepository,
} from "./scheduler";

// Types - Parser
export type { ParsedCron } from "./cron-parser";
