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
 *       await scheduler.tick(env, repository);
 *     }
 *   }
 * };
 * ```
 */

import { redactErrorForLog } from '@ottabase/utils/http-errors';
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

export type TaskHandler<E = unknown, P = unknown> = (context: SchedulerContext<E, P>) => Promise<void> | void;

export type TaskHandlerDefinitions<E, Payloads extends object> = {
    [Name in keyof Payloads]: {
        handler: TaskHandler<E, Payloads[Name]>;
        description?: string;
    };
};

export interface SchedulerOptions<E = unknown> {
    onBeforeTask?: (context: SchedulerContext<E>) => Promise<void> | void;
    onAfterTask?: (context: SchedulerContext<E>) => Promise<void> | void;
    onError?: (error: Error, context: SchedulerContext<E>) => Promise<void> | void;
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
    getTask(id: string): Promise<ScheduledTaskRecord | null>;
    /**
     * Atomically acquire lock on a task.
     * Returns true if lock acquired, false if another worker got there first.
     */
    acquireLock(id: string, startedAt: Date, scheduledOnly: boolean): Promise<boolean>;
    /** Complete only the execution that owns the exact `startedAt` fence. */
    markCompleted(id: string, startedAt: Date, nextRunAt: Date): Promise<boolean>;
    /** Fail only the execution that owns the exact `startedAt` fence. */
    markFailed(id: string, startedAt: Date, error: string, nextRunAt: Date | null): Promise<boolean>;
}

export type TaskExecutionStatus = 'completed' | 'failed' | 'locked' | 'superseded' | 'not_found';

export interface TaskExecutionResult {
    taskId: string;
    status: TaskExecutionStatus;
    error?: string;
}

export interface SchedulerTickResult {
    executed: number;
    failed: number;
    skipped: number;
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

    /** Register a payload-typed handler map as one auditable application registry. */
    registerHandlers<Payloads extends object>(definitions: TaskHandlerDefinitions<E, Payloads>): this {
        for (const name of Object.keys(definitions) as Array<keyof Payloads & string>) {
            const definition = definitions[name];
            this.handler(name, definition.handler, definition.description);
        }
        return this;
    }

    getHandlers(): RegisteredHandler<E>[] {
        return Array.from(this.handlers.values());
    }

    hasHandler(name: string): boolean {
        return this.handlers.has(name);
    }

    async tick(env: E, repository: TaskRepository): Promise<SchedulerTickResult> {
        const result = { executed: 0, failed: 0, skipped: 0 };

        try {
            const dueTasks = await repository.getDueTasks();

            if (dueTasks.length === 0) {
                this.logger.info('No tasks due to run');
                return result;
            }

            this.logger.info(`Found ${dueTasks.length} task(s) due to run`);

            for (const task of dueTasks) {
                const execution = await this.executeTask(task, env, repository, true);
                if (execution.status === 'completed') result.executed++;
                else if (execution.status === 'failed') result.failed++;
                else result.skipped++;
            }

            return result;
        } catch (error) {
            const redacted = redactErrorForLog(error, 500);
            this.logger.error(`Tick failed: ${redacted.message}`);
            throw error;
        }
    }

    private async executeTask(
        candidate: ScheduledTaskRecord,
        env: E,
        repository: TaskRepository,
        scheduledOnly: boolean,
    ): Promise<TaskExecutionResult> {
        const startedAt = new Date();
        // Try to acquire lock atomically
        const acquired = await repository.acquireLock(candidate.id, startedAt, scheduledOnly);
        if (!acquired) {
            this.logger.info(`Task "${candidate.name}" is no longer eligible or is already running, skipping`);
            return { taskId: candidate.id, status: 'locked' };
        }

        // The due-list row can become stale before the lock is won. Reload after
        // acquisition so handler, payload, and schedule come from the locked row.
        const task = await repository.getTask(candidate.id);
        if (!task) return { taskId: candidate.id, status: 'not_found' };

        const context: SchedulerContext<E> = {
            env,
            taskId: task.id,
            taskName: task.name,
            schedule: task.schedule,
            payload: null,
        };

        try {
            if (task.taskType !== 'handler') {
                throw new Error(`Unsupported scheduled task type: ${task.taskType}`);
            }

            const registeredHandler = this.handlers.get(task.task);
            if (!registeredHandler) {
                throw new Error(`No handler registered for scheduled task: ${task.task}`);
            }

            // Payload parsing deliberately happens after the lock and inside this failure
            // boundary. A malformed/corrupt row is persisted as failed instead of stranding
            // the task in `running` forever.
            context.payload = task.payload?.trim() ? JSON.parse(task.payload) : null;

            this.logger.info(`Running task "${task.name}"`);

            if (this.options.onBeforeTask) {
                await this.options.onBeforeTask(context);
            }

            await registeredHandler.handler(context);

            if (this.options.onAfterTask) {
                await this.options.onAfterTask(context);
            }

            const nextRunAt = getNextRun(task.schedule);
            const completed = await repository.markCompleted(task.id, startedAt, nextRunAt);
            if (!completed) {
                this.logger.warn(`Task "${task.name}" completion was superseded by a newer execution`);
                return { taskId: task.id, status: 'superseded' };
            }

            this.logger.info(`Task "${task.name}" completed. Next run: ${nextRunAt.toISOString()}`);
            return { taskId: task.id, status: 'completed' };
        } catch (error) {
            const normalizedError =
                error instanceof Error ? error : new Error('Scheduled task threw a non-Error value');
            const redacted = redactErrorForLog(normalizedError, 500);
            this.logger.error(`Task "${task.name}" failed: ${redacted.message}`);

            let nextRunAt: Date | null = null;
            try {
                nextRunAt = getNextRun(task.schedule);
            } catch {
                // A corrupt schedule cannot be safely retried. The model deactivates rows
                // whose failed execution has no calculable next run.
            }
            const failed = await repository.markFailed(task.id, startedAt, redacted.message, nextRunAt);

            if (this.options.onError) {
                try {
                    await this.options.onError(normalizedError, context);
                } catch (hookError) {
                    const hookLog = redactErrorForLog(hookError, 500);
                    this.logger.error(`Scheduler onError hook failed: ${hookLog.message}`);
                }
            }

            if (!failed) {
                this.logger.warn(`Task "${task.name}" failure was superseded by a newer execution`);
                return { taskId: task.id, status: 'superseded' };
            }

            return { taskId: task.id, status: 'failed', error: redacted.message };
        }
    }

    /** Run a stored task immediately through the same lock/status boundary as a scheduled tick. */
    async runTask(taskId: string, env: E, repository: TaskRepository): Promise<TaskExecutionResult> {
        const task = await repository.getTask(taskId);
        if (!task) {
            return { taskId, status: 'not_found' };
        }

        return this.executeTask(task, env, repository, false);
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
interface ScheduledTaskModelInstance {
    get(key: string): unknown;
}

interface ScheduledTaskModelClass {
    due(): Promise<ScheduledTaskModelInstance[]>;
    find(id: string): Promise<ScheduledTaskModelInstance | null>;
    acquireExecutionLock(
        id: string,
        startedAt: Date,
        staleBefore: Date,
        scheduledOnly: boolean,
        driver: DbDriver,
    ): Promise<boolean>;
    completeExecution(id: string, startedAt: Date, nextRunAt: Date, driver: DbDriver): Promise<boolean>;
    failExecution(
        id: string,
        startedAt: Date,
        error: string,
        nextRunAt: Date | null,
        driver: DbDriver,
    ): Promise<boolean>;
}

export function createTaskRepository(
    Model: ScheduledTaskModelClass,
    driver: DbDriver,
    options: { lockTimeoutMs?: number } = {},
): TaskRepository {
    const lockTimeoutMs = options.lockTimeoutMs ?? 5 * 60 * 1000;

    const toRecord = (task: ScheduledTaskModelInstance): ScheduledTaskRecord => ({
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
    });

    return {
        async getDueTasks(): Promise<ScheduledTaskRecord[]> {
            const tasks = await Model.due();
            return tasks.map(toRecord);
        },

        async getTask(id: string): Promise<ScheduledTaskRecord | null> {
            const task = await Model.find(id);
            return task ? toRecord(task) : null;
        },

        async acquireLock(id: string, startedAt: Date, scheduledOnly: boolean): Promise<boolean> {
            return Model.acquireExecutionLock(
                id,
                startedAt,
                new Date(startedAt.getTime() - lockTimeoutMs),
                scheduledOnly,
                driver,
            );
        },

        async markCompleted(id: string, startedAt: Date, nextRunAt: Date): Promise<boolean> {
            return Model.completeExecution(id, startedAt, nextRunAt, driver);
        },

        async markFailed(id: string, startedAt: Date, error: string, nextRunAt: Date | null): Promise<boolean> {
            return Model.failExecution(id, startedAt, error, nextRunAt, driver);
        },
    };
}
