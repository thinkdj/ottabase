// ============================================================
// @ottabase/ottaorm - ScheduledTask Model
// DB-driven cron scheduler (like Laravel's scheduler)
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { getNextRun } from '@ottabase/cron';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { ValidationError } from '../validation';
import { scheduledTasksTable } from './ScheduledTask.schema';

export { scheduledTasksTable, type NewScheduledTaskType, type ScheduledTaskType } from './ScheduledTask.schema';

/**
 * ScheduledTask model for DB-driven cron scheduler
 *
 * @example
 * ```typescript
 * import { ScheduledTask } from "@ottabase/ottaorm/models";
 *
 * // Create a scheduled task
 * const task = await ScheduledTask.create({
 *   name: "daily-cleanup",
 *   description: "Clean up expired sessions",
 *   schedule: "0 0 * * *",
 *   taskType: "handler",
 *   task: "cleanup:sessions",
 *   appId: "web",
 * });
 *
 * // Get all active tasks
 * const activeTasks = await ScheduledTask.active("web");
 *
 * // Get tasks due to run
 * const dueTasks = await ScheduledTask.due("web");
 * ```
 */
export class ScheduledTask extends BaseModel {
    static entity = 'scheduled_tasks';
    static table = scheduledTasksTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static displayName = 'Scheduled Task';
    static displayNamePlural = 'Scheduled Tasks';
    static defaultSort = 'nextRunAt';
    static defaultSortDirection = 'asc' as const;

    static casts = {
        isActive: 'boolean' as const,
        lastRunAt: 'date' as const,
        nextRunAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Name',
                description: 'Unique identifier for this task',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true },
            validation: {
                rules: 'required|min:2|max:100',
                messages: { required: 'Name is required' },
            },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
                description: 'What this task does',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: true },
        },
        schedule: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Schedule',
                description: 'Cron expression (e.g., 0 0 * * * for daily)',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true },
            validation: {
                rules: 'required',
                messages: { required: 'Schedule is required' },
            },
        },
        taskType: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Task Type',
                description: 'Registered handler',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [{ id: 'handler', name: 'Handler' }],
            },
            tableConfig: { visible: true },
        },
        task: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Task',
                description: 'Registered handler name',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true },
            validation: {
                rules: 'required',
                messages: { required: 'Task is required' },
            },
        },
        payload: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Payload',
                description: 'JSON payload to pass to the task',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        isActive: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'Active' },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: true },
        },
        timezone: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Timezone',
                description: 'Timezone for schedule (default: UTC)',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        lastRunAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Last Run' },
            tableConfig: { visible: true },
        },
        nextRunAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Next Run' },
            tableConfig: { visible: true },
        },
        lastStatus: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Last Status' },
            tableConfig: { visible: true },
        },
        lastError: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Last Error' },
            tableConfig: { visible: false },
        },
        runCount: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Run Count' },
            tableConfig: { visible: true },
        },
        failCount: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Fail Count' },
            tableConfig: { visible: true },
        },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App ID' },
            tableConfig: { visible: false },
            validation: {
                rules: 'required',
                messages: { required: 'App ID is required' },
            },
        },
    };

    // ============================================================
    // WRITE INVARIANTS
    // ============================================================

    /**
     * Validate and normalize every scheduled-task write in the model. Only named
     * handlers are executable: command and URL tasks would create an unbounded
     * code/network execution surface in an admin CRUD form.
     */
    static normalizeDefinition(
        data: Record<string, any>,
        options: {
            registeredHandlers?: readonly string[];
            initializeNextRun?: boolean;
            now?: Date;
        } = {},
    ): Record<string, any> {
        const normalized = { ...data };
        const errors: Record<string, string> = {};

        if (typeof normalized.name === 'string') {
            normalized.name = normalized.name.trim();
        }
        if (typeof normalized.description === 'string') {
            normalized.description = normalized.description.trim() || null;
        }
        if (typeof normalized.schedule === 'string') {
            normalized.schedule = normalized.schedule.trim();
        }
        if (typeof normalized.task === 'string') {
            normalized.task = normalized.task.trim();
        }
        if (typeof normalized.appId === 'string') {
            normalized.appId = normalized.appId.trim();
        }
        if (options.initializeNextRun && !normalized.appId) {
            errors.appId = 'App ID is required';
        }

        const taskType = normalized.taskType ?? 'handler';
        normalized.taskType = taskType;
        if (taskType !== 'handler') {
            errors.taskType = 'Only registered handler tasks are supported';
        }

        if (normalized.timezone !== undefined && normalized.timezone !== null && normalized.timezone !== 'UTC') {
            errors.timezone = 'Scheduled tasks currently support UTC only';
        }
        normalized.timezone = 'UTC';

        if (typeof normalized.task === 'string' && !/^[a-z0-9][a-z0-9:_-]*$/.test(normalized.task)) {
            errors.task = 'Handler name contains unsupported characters';
        }
        if (
            normalized.task &&
            options.registeredHandlers &&
            !options.registeredHandlers.includes(normalized.task as string)
        ) {
            errors.task = 'Handler is not registered by this application';
        }

        if (normalized.payload === '') normalized.payload = null;
        if (normalized.payload !== undefined && normalized.payload !== null) {
            if (typeof normalized.payload !== 'string') {
                errors.payload = 'Payload must be a JSON string';
            } else {
                try {
                    JSON.parse(normalized.payload);
                } catch {
                    errors.payload = 'Payload must contain valid JSON';
                }
            }
        }

        let calculatedNextRun: Date | null | undefined;
        if (normalized.schedule !== undefined) {
            if (typeof normalized.schedule !== 'string' || normalized.schedule.length === 0) {
                errors.schedule = 'Schedule is required';
            } else {
                try {
                    calculatedNextRun = getNextRun(normalized.schedule, options.now ?? new Date());
                } catch {
                    errors.schedule = 'Schedule must be a valid five-field cron expression';
                }
            }
        }

        if (options.initializeNextRun) {
            const active = normalized.isActive ?? true;
            normalized.nextRunAt = active ? calculatedNextRun : null;
        } else if (normalized.isActive === false) {
            normalized.nextRunAt = null;
        } else if (normalized.isActive === true && normalized.nextRunAt === undefined && calculatedNextRun) {
            normalized.nextRunAt = calculatedNextRun;
        }

        if (Object.keys(errors).length > 0) {
            throw new ValidationError(errors);
        }

        return normalized;
    }

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const normalized = ScheduledTask.normalizeDefinition(data, { initializeNextRun: true });
        return (await super.create.call(this, normalized, driver)) as InstanceType<T>;
    }

    /** Create a task only when its handler exists in the app's explicit registry. */
    static async createRegistered<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        registeredHandlers: readonly string[],
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const normalized = ScheduledTask.normalizeDefinition(data, {
            registeredHandlers,
            initializeNextRun: true,
        });
        return (await super.create.call(this, normalized, driver)) as InstanceType<T>;
    }

    protected static async prepareUpdateMutation(data: Record<string, any>): Promise<Record<string, any>> {
        // App ownership is stamped by the server at creation and is immutable thereafter.
        delete data.appId;
        return ScheduledTask.normalizeDefinition(data);
    }

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /**
     * Get all active scheduled tasks
     */
    static async active(appId: string, limit = 100) {
        return this.where(
            { appId, isActive: true },
            { orderBy: 'nextRunAt', orderDirection: 'asc', limit: Math.min(Math.max(limit, 1), 100) },
        );
    }

    /**
     * Get tasks that are due to run (nextRunAt <= now and active)
     */
    static async due(appId: string, limit = 100, now = Date.now()) {
        return this.where(
            { appId, isActive: true, nextRunAt: { $lte: now } },
            { orderBy: 'nextRunAt', orderDirection: 'asc', limit: Math.min(Math.max(limit, 1), 100) },
        );
    }

    /**
     * Find task by name
     */
    static async findByName(appId: string, name: string) {
        return this.first({ appId, name });
    }

    /** Find only inside the configured app partition. */
    static async findForApp(id: string, appId: string) {
        return this.first({ id, appId });
    }

    /**
     * Atomically claim one execution. Scheduled ticks also re-check active/due
     * state in this statement so a stale due-list read cannot run a paused or
     * rescheduled task. `lastRunAt` is the fencing token for the claimed run.
     */
    static async acquireExecutionLock(
        id: string,
        appId: string,
        startedAt: Date,
        staleBefore: Date,
        scheduledOnly: boolean,
        driver: Pick<DbDriver, 'executeRaw'>,
    ): Promise<boolean> {
        const startedAtMs = startedAt.getTime();
        const result = await driver.executeRaw(
            `UPDATE scheduled_tasks
             SET last_status = 'running', last_run_at = ?, updated_at = ?
             WHERE id = ? AND app_id = ?
               AND (last_status IS NULL OR last_status != 'running' OR last_run_at IS NULL OR last_run_at < ?)
               AND (? = 0 OR (is_active = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?))`,
            [startedAtMs, startedAtMs, id, appId, staleBefore.getTime(), scheduledOnly ? 1 : 0, startedAtMs],
        );
        return (result.meta?.changes ?? 0) > 0;
    }

    /** Complete only the execution that still owns `startedAt`. */
    static async completeExecution(
        id: string,
        appId: string,
        startedAt: Date,
        nextRunAt: Date,
        driver: Pick<DbDriver, 'executeRaw'>,
    ): Promise<boolean> {
        const finishedAt = Math.max(Date.now(), startedAt.getTime() + 1);
        const result = await driver.executeRaw(
            `UPDATE scheduled_tasks
             SET last_status = 'success', last_run_at = ?, next_run_at = ?, last_error = NULL,
                 run_count = run_count + 1, updated_at = ?
             WHERE id = ? AND app_id = ? AND last_status = 'running' AND last_run_at = ?`,
            [finishedAt, nextRunAt.getTime(), finishedAt, id, appId, startedAt.getTime()],
        );
        return (result.meta?.changes ?? 0) > 0;
    }

    /** Fail only the execution that still owns `startedAt`. */
    static async failExecution(
        id: string,
        appId: string,
        startedAt: Date,
        error: string,
        nextRunAt: Date | null,
        driver: Pick<DbDriver, 'executeRaw'>,
    ): Promise<boolean> {
        const finishedAt = Math.max(Date.now(), startedAt.getTime() + 1);
        const result = await driver.executeRaw(
            `UPDATE scheduled_tasks
             SET last_status = 'failed', last_run_at = ?, next_run_at = ?, last_error = ?,
                 run_count = run_count + 1, fail_count = fail_count + 1,
                 is_active = CASE WHEN ? IS NULL THEN 0 ELSE is_active END, updated_at = ?
             WHERE id = ? AND app_id = ? AND last_status = 'running' AND last_run_at = ?`,
            [
                finishedAt,
                nextRunAt?.getTime() ?? null,
                error.slice(0, 2_000),
                nextRunAt?.getTime() ?? null,
                finishedAt,
                id,
                appId,
                startedAt.getTime(),
            ],
        );
        return (result.meta?.changes ?? 0) > 0;
    }

    // ============================================================
    // INSTANCE HELPERS
    // ============================================================

    /**
     * Get parsed payload as object
     */
    getPayload<T = unknown>(): T | null {
        const payload = this.get('payload') as string | null;
        if (!payload) return null;
        try {
            return JSON.parse(payload) as T;
        } catch {
            return null;
        }
    }

    /**
     * Toggle active status
     */
    async toggle() {
        const isActive = !this.get('isActive');
        this.set('isActive', isActive);
        this.set('nextRunAt', isActive ? getNextRun(this.get('schedule') as string) : null);
        return this.save();
    }
}
