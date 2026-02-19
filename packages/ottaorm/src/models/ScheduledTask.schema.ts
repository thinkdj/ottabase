// ============================================================
// @ottabase/ottaorm - ScheduledTask table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ScheduledTask table schema
 */
export const scheduledTasksTable = sqliteTable('scheduled_tasks', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    // Cron expression (e.g., "0 0 * * *" for daily at midnight)
    schedule: text('schedule').notNull(),
    // Task type: "command" | "url" | "handler"
    taskType: text('task_type').notNull().default('handler'),
    // Command/URL/handler name to execute
    task: text('task').notNull(),
    // JSON payload to pass to the task
    payload: text('payload'),
    // Whether the task is active
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    // Timezone for schedule evaluation (default: UTC)
    timezone: text('timezone').default('UTC'),
    // Last run timestamp
    lastRunAt: integer('last_run_at'),
    // Next scheduled run timestamp
    nextRunAt: integer('next_run_at'),
    // Last run status: "success" | "failed" | "running" | null
    lastStatus: text('last_status'),
    // Last error message if failed
    lastError: text('last_error'),
    // Run count
    runCount: integer('run_count').notNull().default(0),
    // Fail count
    failCount: integer('fail_count').notNull().default(0),
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ScheduledTaskType = typeof scheduledTasksTable.$inferSelect;
export type NewScheduledTaskType = typeof scheduledTasksTable.$inferInsert;
