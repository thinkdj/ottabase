// ============================================================
// @ottabase/ottaorm - ScheduledTask Model
// DB-driven cron scheduler (like Laravel's scheduler)
// ============================================================

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { BaseModel, IModelConstructorParams, ModelFields } from "../base/BaseModel";

/**
 * ScheduledTask table schema
 */
export const scheduledTasksTable = sqliteTable("scheduled_tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  // Cron expression (e.g., "0 0 * * *" for daily at midnight)
  schedule: text("schedule").notNull(),
  // Task type: "command" | "url" | "handler"
  taskType: text("task_type").notNull().default("handler"),
  // Command/URL/handler name to execute
  task: text("task").notNull(),
  // JSON payload to pass to the task
  payload: text("payload"),
  // Whether the task is active
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // Timezone for schedule evaluation (default: UTC)
  timezone: text("timezone").default("UTC"),
  // Last run timestamp
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  // Next scheduled run timestamp
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  // Last run status: "success" | "failed" | "running" | null
  lastStatus: text("last_status"),
  // Last error message if failed
  lastError: text("last_error"),
  // Run count
  runCount: integer("run_count").notNull().default(0),
  // Fail count
  failCount: integer("fail_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export type ScheduledTaskType = typeof scheduledTasksTable.$inferSelect;
export type NewScheduledTaskType = typeof scheduledTasksTable.$inferInsert;

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
 * });
 *
 * // Get all active tasks
 * const activeTasks = await ScheduledTask.active();
 *
 * // Get tasks due to run
 * const dueTasks = await ScheduledTask.due();
 * ```
 */
export class ScheduledTask extends BaseModel {
  static entity = "scheduled_tasks";
  static table = scheduledTasksTable;
  static primaryKey = "id";

  static displayName = "Scheduled Task";
  static displayNamePlural = "Scheduled Tasks";
  static defaultSort = "nextRunAt";
  static defaultSortDirection = "asc" as const;

  static casts = {
    isActive: "boolean" as const,
    lastRunAt: "date" as const,
    nextRunAt: "date" as const,
    createdAt: "date" as const,
    updatedAt: "date" as const,
  };

  protected static fields: ModelFields = {
    id: {
      type: "id",
      primaryKey: true,
      editable: false,
      uiConfig: { label: "ID" },
    },
    name: {
      type: "string",
      editable: true,
      searchable: true,
      uiConfig: {
        label: "Name",
        description: "Unique identifier for this task",
      },
      formConfig: { visible: true, fieldType: "input" },
      tableConfig: { visible: true },
      validation: {
        rules: "required|min:2|max:100",
        messages: { required: "Name is required" },
      },
    },
    description: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Description",
        description: "What this task does",
      },
      formConfig: { visible: true, fieldType: "textarea" },
      tableConfig: { visible: true },
    },
    schedule: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Schedule",
        description: "Cron expression (e.g., 0 0 * * * for daily)",
      },
      formConfig: { visible: true, fieldType: "input" },
      tableConfig: { visible: true },
      validation: {
        rules: "required",
        messages: { required: "Schedule is required" },
      },
    },
    taskType: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Task Type",
        description: "handler, command, or url",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
        options: [
          { id: "handler", name: "Handler" },
          { id: "command", name: "Command" },
          { id: "url", name: "URL" },
        ],
      },
      tableConfig: { visible: true },
    },
    task: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Task",
        description: "Handler name, command, or URL to execute",
      },
      formConfig: { visible: true, fieldType: "input" },
      tableConfig: { visible: true },
      validation: {
        rules: "required",
        messages: { required: "Task is required" },
      },
    },
    payload: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Payload",
        description: "JSON payload to pass to the task",
      },
      formConfig: { visible: true, fieldType: "textarea" },
      tableConfig: { visible: false },
    },
    isActive: {
      type: "boolean",
      editable: true,
      uiConfig: { label: "Active" },
      formConfig: { visible: true, fieldType: "boolean" },
      tableConfig: { visible: true },
    },
    timezone: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Timezone",
        description: "Timezone for schedule (default: UTC)",
      },
      formConfig: { visible: true, fieldType: "input" },
      tableConfig: { visible: false },
    },
    lastRunAt: {
      type: "date",
      editable: false,
      uiConfig: { label: "Last Run" },
      tableConfig: { visible: true },
    },
    nextRunAt: {
      type: "date",
      editable: false,
      uiConfig: { label: "Next Run" },
      tableConfig: { visible: true },
    },
    lastStatus: {
      type: "string",
      editable: false,
      uiConfig: { label: "Last Status" },
      tableConfig: { visible: true },
    },
    lastError: {
      type: "string",
      editable: false,
      uiConfig: { label: "Last Error" },
      tableConfig: { visible: false },
    },
    runCount: {
      type: "number",
      editable: false,
      uiConfig: { label: "Run Count" },
      tableConfig: { visible: true },
    },
    failCount: {
      type: "number",
      editable: false,
      uiConfig: { label: "Fail Count" },
      tableConfig: { visible: true },
    },
  };

  constructor(data: { [key: string]: any }) {
    const params: IModelConstructorParams = { entity: ScheduledTask.entity, data };
    super(params);
  }

  // ============================================================
  // QUERY HELPERS
  // ============================================================

  /**
   * Get all active scheduled tasks
   */
  static async active() {
    return this.where({ isActive: true });
  }

  /**
   * Get tasks that are due to run (nextRunAt <= now and active)
   */
  static async due() {
    const now = new Date();
    const tasks = await this.where({ isActive: true });
    return tasks.filter((task) => {
      const nextRun = task.get("nextRunAt") as Date | null;
      return nextRun && nextRun <= now;
    });
  }

  /**
   * Find task by name
   */
  static async findByName(name: string) {
    return this.first({ name });
  }

  // ============================================================
  // INSTANCE HELPERS
  // ============================================================

  /**
   * Get parsed payload as object
   */
  getPayload<T = unknown>(): T | null {
    const payload = this.get("payload") as string | null;
    if (!payload) return null;
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  /**
   * Mark task as running
   */
  async markRunning() {
    this.set("lastStatus", "running");
    return this.save();
  }

  /**
   * Mark task as completed
   */
  async markCompleted(nextRunAt: Date) {
    this.set("lastStatus", "success");
    this.set("lastRunAt", new Date());
    this.set("nextRunAt", nextRunAt);
    this.set("lastError", null);
    this.set("runCount", (this.get("runCount") as number) + 1);
    return this.save();
  }

  /**
   * Mark task as failed
   */
  async markFailed(error: string, nextRunAt: Date) {
    this.set("lastStatus", "failed");
    this.set("lastRunAt", new Date());
    this.set("nextRunAt", nextRunAt);
    this.set("lastError", error);
    this.set("runCount", (this.get("runCount") as number) + 1);
    this.set("failCount", (this.get("failCount") as number) + 1);
    return this.save();
  }

  /**
   * Toggle active status
   */
  async toggle() {
    this.set("isActive", !this.get("isActive"));
    return this.save();
  }
}
