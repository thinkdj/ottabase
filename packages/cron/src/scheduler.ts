/**
 * DB-driven cron scheduler (like Laravel's scheduler)
 *
 * Register task handlers and let the scheduler run them based on DB entries.
 * Run `scheduler.tick()` from a "* * * * *" cron trigger to process due tasks.
 *
 * @example
 * ```typescript
 * import { createScheduler } from "@ottabase/cron";
 *
 * const scheduler = createScheduler<Env>()
 *   .handler("cleanup:sessions", async ({ env, payload }) => {
 *     await env.DB.execute("DELETE FROM sessions WHERE expires < ?", [Date.now()]);
 *   })
 *   .handler("send:digest", async ({ env, payload }) => {
 *     await sendDigestEmail(payload.userId);
 *   });
 *
 * // In your worker's scheduled handler:
 * export default {
 *   async scheduled(event, env, ctx) {
 *     if (event.cron === "* * * * *") {
 *       await scheduler.tick(env, ctx);
 *     }
 *   }
 * };
 * ```
 */

import { getNextRun, matchesCron } from "./cron-parser";

// ============================================================
// Types
// ============================================================

export interface SchedulerContext<E = unknown, P = unknown> {
  env: E;
  taskId: string;
  taskName: string;
  schedule: string;
  payload: P | null;
}

export type TaskHandler<E = unknown, P = unknown> = (
  context: SchedulerContext<E, P>
) => Promise<void>;

export interface SchedulerOptions<E = unknown> {
  /**
   * Called before each task runs
   */
  onBeforeTask?: (context: SchedulerContext<E>) => Promise<void>;

  /**
   * Called after each task completes successfully
   */
  onAfterTask?: (context: SchedulerContext<E>) => Promise<void>;

  /**
   * Called when a task fails. If not provided, errors are logged and the task is marked failed.
   */
  onError?: (error: Error, context: SchedulerContext<E>) => Promise<void>;

  /**
   * Custom logger (defaults to console)
   */
  logger?: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };
}

export interface RegisteredHandler<E = unknown> {
  name: string;
  handler: TaskHandler<E>;
  description?: string;
}

/**
 * Record representing a scheduled task from the database.
 * Note: All schedules are evaluated in UTC. Timezone support may be added in future versions.
 */
export interface ScheduledTaskRecord {
  id: string;
  name: string;
  description?: string | null;
  schedule: string;
  taskType: string;
  task: string;
  payload?: string | null;
  isActive: boolean;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  lastStatus?: string | null;
  lastError?: string | null;
  runCount: number;
  failCount: number;
}

export interface TaskRepository {
  getDueTasks(): Promise<ScheduledTaskRecord[]>;
  /**
   * Attempt to mark task as running (acquire lock).
   * Returns true if successful, false if another worker got there first.
   */
  markRunning(id: string): Promise<boolean>;
  markCompleted(id: string, nextRunAt: Date): Promise<void>;
  markFailed(id: string, error: string, nextRunAt: Date): Promise<void>;
}

// ============================================================
// Scheduler Class
// ============================================================

export class Scheduler<E = unknown> {
  private handlers = new Map<string, RegisteredHandler<E>>();
  private options: SchedulerOptions<E>;
  private logger: NonNullable<SchedulerOptions<E>["logger"]>;

  constructor(options: SchedulerOptions<E> = {}) {
    this.options = options;
    this.logger = options.logger ?? {
      info: (msg) => console.log(`[scheduler] ${msg}`),
      error: (msg) => console.error(`[scheduler] ${msg}`),
      warn: (msg) => console.warn(`[scheduler] ${msg}`),
    };
  }

  /**
   * Register a task handler
   */
  handler<P = unknown>(
    name: string,
    handler: TaskHandler<E, P>,
    description?: string
  ): this {
    this.handlers.set(name, {
      name,
      handler: handler as TaskHandler<E>,
      description,
    });
    return this;
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): RegisteredHandler<E>[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Check if a handler is registered
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Run the scheduler tick - checks for due tasks and executes them
   *
   * @param env - Worker environment bindings
   * @param ctx - Execution context (for waitUntil)
   * @param repository - Task repository for DB operations
   */
  async tick(
    env: E,
    ctx: { waitUntil: (promise: Promise<unknown>) => void },
    repository: TaskRepository
  ): Promise<{ executed: number; failed: number; skipped: number }> {
    const result = { executed: 0, failed: 0, skipped: 0 };

    try {
      const dueTasks = await repository.getDueTasks();

      if (dueTasks.length === 0) {
        this.logger.info("No tasks due to run");
        return result;
      }

      this.logger.info(`Found ${dueTasks.length} task(s) due to run`);

      for (const task of dueTasks) {
        // Only process "handler" type tasks
        if (task.taskType !== "handler") {
          this.logger.warn(
            `Skipping task "${task.name}" - type "${task.taskType}" not supported`
          );
          result.skipped++;
          continue;
        }

        const handler = this.handlers.get(task.task);
        if (!handler) {
          this.logger.warn(
            `No handler registered for task "${task.task}" (task: ${task.name})`
          );
          result.skipped++;
          continue;
        }

        // Execute the task
        const taskPromise = this.executeTask(task, handler, env, repository);

        // Use waitUntil to ensure the task completes even if the request ends
        ctx.waitUntil(
          taskPromise.then((success) => {
            if (success) {
              result.executed++;
            } else {
              result.failed++;
            }
          })
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Tick failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: ScheduledTaskRecord,
    registeredHandler: RegisteredHandler<E>,
    env: E,
    repository: TaskRepository
  ): Promise<boolean> {
    const context: SchedulerContext<E> = {
      env,
      taskId: task.id,
      taskName: task.name,
      schedule: task.schedule,
      payload: task.payload ? JSON.parse(task.payload) : null,
    };

    try {
      // Attempt to acquire lock by marking as running
      const acquired = await repository.markRunning(task.id);
      if (!acquired) {
        // Another worker got there first
        this.logger.info(`Task "${task.name}" already running, skipping`);
        return false;
      }
      this.logger.info(`Running task "${task.name}"`);

      // Before hook
      if (this.options.onBeforeTask) {
        await this.options.onBeforeTask(context);
      }

      // Execute handler
      await registeredHandler.handler(context);

      // Calculate next run
      const nextRunAt = getNextRun(task.schedule);

      // Mark completed
      await repository.markCompleted(task.id, nextRunAt);

      // After hook
      if (this.options.onAfterTask) {
        await this.options.onAfterTask(context);
      }

      this.logger.info(
        `Task "${task.name}" completed. Next run: ${nextRunAt.toISOString()}`
      );
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Task "${task.name}" failed: ${errorMessage}`);

      // Calculate next run even on failure
      const nextRunAt = getNextRun(task.schedule);

      // Mark failed
      await repository.markFailed(task.id, errorMessage, nextRunAt);

      // Error hook
      if (this.options.onError) {
        await this.options.onError(error as Error, context);
      }

      return false;
    }
  }

  /**
   * Manually run a specific task by name (for testing/debugging)
   */
  async runTask(
    taskName: string,
    env: E,
    payload?: unknown
  ): Promise<void> {
    const handler = this.handlers.get(taskName);
    if (!handler) {
      throw new Error(`No handler registered for task: ${taskName}`);
    }

    const context: SchedulerContext<E> = {
      env,
      taskId: "manual",
      taskName,
      schedule: "manual",
      payload: payload ?? null,
    };

    await handler.handler(context);
  }
}

/**
 * Create a new scheduler instance
 */
export function createScheduler<E = unknown>(
  options?: SchedulerOptions<E>
): Scheduler<E> {
  return new Scheduler<E>(options);
}

// ============================================================
// Repository Factory
// ============================================================

/**
 * Create a task repository from a model class
 * Works with OttaORM ScheduledTask model
 */
export function createTaskRepository<M extends {
  due(): Promise<Array<{
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    save(): Promise<void>;
  }>>;
  find(id: string): Promise<{
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    save(): Promise<void>;
  } | null>;
}>(Model: M): TaskRepository {
  return {
    async getDueTasks(): Promise<ScheduledTaskRecord[]> {
      const tasks = await Model.due();
      return tasks.map((task) => ({
        id: task.get("id") as string,
        name: task.get("name") as string,
        description: task.get("description") as string | null,
        schedule: task.get("schedule") as string,
        taskType: task.get("taskType") as string,
        task: task.get("task") as string,
        payload: task.get("payload") as string | null,
        isActive: task.get("isActive") as boolean,
        lastRunAt: task.get("lastRunAt") as Date | null,
        nextRunAt: task.get("nextRunAt") as Date | null,
        lastStatus: task.get("lastStatus") as string | null,
        lastError: task.get("lastError") as string | null,
        runCount: task.get("runCount") as number,
        failCount: task.get("failCount") as number,
      }));
    },

    async markRunning(id: string): Promise<boolean> {
      const task = await Model.find(id);
      if (!task) return false;

      // Check if already running (another worker got there first)
      const currentStatus = task.get("lastStatus") as string | null;
      if (currentStatus === "running") {
        return false;
      }

      task.set("lastStatus", "running");
      await task.save();
      return true;
    },

    async markCompleted(id: string, nextRunAt: Date): Promise<void> {
      const task = await Model.find(id);
      if (task) {
        task.set("lastStatus", "success");
        task.set("lastRunAt", new Date());
        task.set("nextRunAt", nextRunAt);
        task.set("lastError", null);
        task.set("runCount", (task.get("runCount") as number) + 1);
        await task.save();
      }
    },

    async markFailed(id: string, error: string, nextRunAt: Date): Promise<void> {
      const task = await Model.find(id);
      if (task) {
        task.set("lastStatus", "failed");
        task.set("lastRunAt", new Date());
        task.set("nextRunAt", nextRunAt);
        task.set("lastError", error);
        task.set("runCount", (task.get("runCount") as number) + 1);
        task.set("failCount", (task.get("failCount") as number) + 1);
        await task.save();
      }
    },
  };
}
