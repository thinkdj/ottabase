// ============================================================
// @ottabase/ottaorm - ScheduledTask table schema
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ScheduledTask table schema
 */
export const scheduledTasksTable = sqliteTable(
    'scheduled_tasks',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        name: text('name').notNull(),
        description: text('description'),
        // Cron expression (e.g., "0 0 * * *" for daily at midnight)
        schedule: text('schedule').notNull(),
        // Only registered application handlers are executable.
        taskType: text('task_type').notNull().default('handler'),
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
        // Server-configured app partition. Required so a shared D1 cannot execute another app's task.
        appId: text('app_id').notNull(),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [index('scheduled_tasks_due_idx').on(table.appId, table.isActive, table.nextRunAt, table.id)],
);

export type ScheduledTaskType = typeof scheduledTasksTable.$inferSelect;
export type NewScheduledTaskType = typeof scheduledTasksTable.$inferInsert;
