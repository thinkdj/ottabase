/**
 * DB-driven cron scheduler (like Laravel's scheduler)
 *
 * Register task handlers and let the scheduler run them based on DB entries.
 * Run `scheduler.tick()` from a "* * * * *" cron trigger to process due tasks.
 *
 * @example
 * ```typescript
 * import { createScheduler, createTaskRepository } from "@ottabase/cron";
 * import { ScheduledTask } from "@ottabase/ottaorm/models";
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * const scheduler = createScheduler<Env>()
 *   .handler("cleanup:sessions", async ({ env }) => {
 *     await env.DB.execute("DELETE FROM sessions WHERE expires < ?", [Date.now()]);
 *   });
 *
 * // In your worker's scheduled handler:
 * export default {
 *   async scheduled(event, env, ctx) {
 *     if (event.cron === "* * * * *") {
 *       const driver = createD1Driver(env.OBCF_D1);
 *       const repository = createTaskRepository(ScheduledTask, driver);
 *       await scheduler.tick(env, ctx, repository);
 *     }
 *   }
 * };
 * ```
 */

import { getNextRun } from './cron-parser';

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

export type TaskHandler<E = unknown, P = unknown> = (context: SchedulerContext<E, P>) => Promise<void>;

export interface SchedulerOptions<E = unknown> {
    onBeforeTask?: (context: SchedulerContext<E>) => Promise<void>;
    onAfterTask?: (context: SchedulerContext<E>) => Promise<void>;
    onError?: (error: Error, context: SchedulerContext<E>) => Promise<void>;
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
 * All schedules are evaluated in UTC.
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
     * Atomically acquire lock on a task.
     * Returns true if lock acquired, false if another worker got there first.
     */
    acquireLock(id: string): Promise<boolean>;
    markCompleted(id: string, nextRunAt: Date): Promise<void>;
    markFailed(id: string, error: string, nextRunAt: Date): Promise<void>;
}

// ============================================================
// Scheduler Class
// ============================================================

export class Scheduler<E = unknown> {
    private handlers = new Map<string, RegisteredHandler<E>>();
    private options: SchedulerOptions<E>;
    private logger: NonNullable<SchedulerOptions<E>['logger']>;

    constructor(options: SchedulerOptions<E> = {}) {
        this.options = options;
        this.logger = options.logger ?? {
            info: (msg) => console.log(`[scheduler] ${msg}`),
            error: (msg) => console.error(`[scheduler] ${msg}`),
            warn: (msg) => console.warn(`[scheduler] ${msg}`),
        };
    }

    handler<P = unknown>(name: string, handler: TaskHandler<E, P>, description?: string): this {
        this.handlers.set(name, {
            name,
            handler: handler as TaskHandler<E>,
            description,
        });
        return this;
    }

    getHandlers(): RegisteredHandler<E>[] {
        return Array.from(this.handlers.values());
    }

    hasHandler(name: string): boolean {
        return this.handlers.has(name);
    }

    async tick(
        env: E,
        ctx: { waitUntil: (promise: Promise<unknown>) => void },
        repository: TaskRepository,
    ): Promise<{ executed: number; failed: number; skipped: number }> {
        const result = { executed: 0, failed: 0, skipped: 0 };

        try {
            const dueTasks = await repository.getDueTasks();

            if (dueTasks.length === 0) {
                this.logger.info('No tasks due to run');
                return result;
            }

            this.logger.info(`Found ${dueTasks.length} task(s) due to run`);

            for (const task of dueTasks) {
                if (task.taskType !== 'handler') {
                    this.logger.warn(`Skipping task "${task.name}" - type "${task.taskType}" not supported`);
                    result.skipped++;
                    continue;
                }

                const handler = this.handlers.get(task.task);
                if (!handler) {
                    this.logger.warn(`No handler registered for task "${task.task}" (task: ${task.name})`);
                    result.skipped++;
                    continue;
                }

                ctx.waitUntil(
                    this.executeTask(task, handler, env, repository).then((success) => {
                        if (success) {
                            result.executed++;
                        } else {
                            result.skipped++; // Lock not acquired = skipped, not failed
                        }
                    }),
                );
            }

            return result;
        } catch (error) {
            this.logger.error(`Tick failed: ${(error as Error).message}`);
            throw error;
        }
    }

    private async executeTask(
        task: ScheduledTaskRecord,
        registeredHandler: RegisteredHandler<E>,
        env: E,
        repository: TaskRepository,
    ): Promise<boolean> {
        // Try to acquire lock atomically
        const acquired = await repository.acquireLock(task.id);
        if (!acquired) {
            this.logger.info(`Task "${task.name}" already running, skipping`);
            return false;
        }

        const context: SchedulerContext<E> = {
            env,
            taskId: task.id,
            taskName: task.name,
            schedule: task.schedule,
            payload: task.payload ? JSON.parse(task.payload) : null,
        };

        try {
            this.logger.info(`Running task "${task.name}"`);

            if (this.options.onBeforeTask) {
                await this.options.onBeforeTask(context);
            }

            await registeredHandler.handler(context);

            const nextRunAt = getNextRun(task.schedule);
            await repository.markCompleted(task.id, nextRunAt);

            if (this.options.onAfterTask) {
                await this.options.onAfterTask(context);
            }

            this.logger.info(`Task "${task.name}" completed. Next run: ${nextRunAt.toISOString()}`);
            return true;
        } catch (error) {
            const errorMessage = (error as Error).message;
            this.logger.error(`Task "${task.name}" failed: ${errorMessage}`);

            const nextRunAt = getNextRun(task.schedule);
            await repository.markFailed(task.id, errorMessage, nextRunAt);

            if (this.options.onError) {
                await this.options.onError(error as Error, context);
            }

            return true; // Task ran (and failed), lock was acquired
        }
    }

    async runTask(taskName: string, env: E, payload?: unknown): Promise<void> {
        const handler = this.handlers.get(taskName);
        if (!handler) {
            throw new Error(`No handler registered for task: ${taskName}`);
        }

        const context: SchedulerContext<E> = {
            env,
            taskId: 'manual',
            taskName,
            schedule: 'manual',
            payload: payload ?? null,
        };

        await handler.handler(context);
    }
}

export function createScheduler<E = unknown>(options?: SchedulerOptions<E>): Scheduler<E> {
    return new Scheduler<E>(options);
}

// ============================================================
// Repository Factory with Atomic Locking
// ============================================================

/**
 * Database driver interface (subset of @ottabase/db DbDriver)
 */
export interface DbDriver {
    executeRaw(
        sql: string,
        params?: unknown[],
    ): Promise<{
        results?: unknown[];
        success?: boolean;
        meta?: { changes?: number };
    }>;
}

/**
 * Create a task repository with atomic locking
 *
 * @param Model - OttaORM ScheduledTask model class
 * @param driver - Database driver for atomic SQL operations
 */
export function createTaskRepository<
    M extends {
        due(): Promise<
            Array<{
                get(key: string): unknown;
                set(key: string, value: unknown): void;
                save(): Promise<void>;
            }>
        >;
        find(id: string): Promise<{
            get(key: string): unknown;
            set(key: string, value: unknown): void;
            save(): Promise<void>;
        } | null>;
    },
>(Model: M, driver: DbDriver): TaskRepository {
    return {
        async getDueTasks(): Promise<ScheduledTaskRecord[]> {
            const tasks = await Model.due();
            return tasks.map((task) => ({
                id: task.get('id') as string,
                name: task.get('name') as string,
                description: task.get('description') as string | null,
                schedule: task.get('schedule') as string,
                taskType: task.get('taskType') as string,
                task: task.get('task') as string,
                payload: task.get('payload') as string | null,
                isActive: task.get('isActive') as boolean,
                lastRunAt: task.get('lastRunAt') as Date | null,
                nextRunAt: task.get('nextRunAt') as Date | null,
                lastStatus: task.get('lastStatus') as string | null,
                lastError: task.get('lastError') as string | null,
                runCount: task.get('runCount') as number,
                failCount: task.get('failCount') as number,
            }));
        },

        async acquireLock(id: string): Promise<boolean> {
            // Atomic UPDATE - only succeeds if task is not already running
            const result = await driver.executeRaw(
                `UPDATE scheduled_tasks
         SET last_status = 'running'
         WHERE id = ? AND (last_status IS NULL OR last_status != 'running')`,
                [id],
            );
            // Check if any rows were affected
            return (result.meta?.changes ?? 0) > 0;
        },

        async markCompleted(id: string, nextRunAt: Date): Promise<void> {
            const task = await Model.find(id);
            if (task) {
                task.set('lastStatus', 'success');
                task.set('lastRunAt', Date.now());
                task.set('nextRunAt', nextRunAt.getTime());
                task.set('lastError', null);
                task.set('runCount', (task.get('runCount') as number) + 1);
                await task.save();
            }
        },

        async markFailed(id: string, error: string, nextRunAt: Date): Promise<void> {
            const task = await Model.find(id);
            if (task) {
                task.set('lastStatus', 'failed');
                task.set('lastRunAt', Date.now());
                task.set('nextRunAt', nextRunAt.getTime());
                task.set('lastError', error);
                task.set('runCount', (task.get('runCount') as number) + 1);
                task.set('failCount', (task.get('failCount') as number) + 1);
                await task.save();
            }
        },
    };
}
