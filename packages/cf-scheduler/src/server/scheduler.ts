/**
 * Task scheduler service for Cloudflare Workers
 * Manages scheduled tasks stored in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  ScheduledTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskLog,
  TaskExecutionResult,
  TaskHandlerRegistry,
  SchedulerConfig,
} from '../types';
import { getCronExpression, getNextRunTime, shouldRunNow } from '../utils/cron';

// Maximum payload size (1MB - leaving room for other fields)
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

// Retry delay in minutes after task failure
const RETRY_DELAY_MINUTES = 1;

export class Scheduler {
  private db: D1Database;
  private handlers: TaskHandlerRegistry;
  private config: Required<SchedulerConfig>;

  constructor(db: D1Database, config: SchedulerConfig = {}) {
    this.db = db;
    this.handlers = config.handlers || {};
    this.config = {
      databaseBindingName: config.databaseBindingName || 'DB',
      maxTasksPerRun: config.maxTasksPerRun || 10,
      enableLogging: config.enableLogging !== false,
      handlers: this.handlers,
    };
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        frequency TEXT NOT NULL,
        cron_expression TEXT,
        handler TEXT NOT NULL,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        last_run_at TEXT,
        next_run_at TEXT,
        run_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        timeout_seconds INTEGER NOT NULL DEFAULT 300,
        skip_missed INTEGER NOT NULL DEFAULT 0,
        execution_lock_id TEXT,
        execution_locked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_app_id ON scheduled_tasks(app_id);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_lock ON scheduled_tasks(execution_lock_id);
      -- Compound index for efficient getDueTasks query
      CREATE INDEX IF NOT EXISTS idx_due_tasks ON scheduled_tasks(status, next_run_at, execution_lock_id) WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS task_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        execution_time_ms INTEGER,
        output TEXT,
        FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_started_at ON task_logs(started_at);
    `);
  }

  /**
   * Create a new scheduled task
   */
  async createTask(input: CreateTaskInput): Promise<ScheduledTask> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cronExpression = getCronExpression(input.frequency, input.cron_expression);
    const nextRunAt = getNextRunTime(cronExpression);

    // Validate payload size to prevent D1 row size limit issues
    const payloadStr = input.payload ? JSON.stringify(input.payload) : undefined;
    if (payloadStr && payloadStr.length > MAX_PAYLOAD_SIZE) {
      throw new Error(
        `Payload too large: ${payloadStr.length} bytes (max: ${MAX_PAYLOAD_SIZE} bytes)`
      );
    }

    const task: ScheduledTask = {
      id,
      app_id: input.app_id || 'default', // Default to 'default' if not provided
      name: input.name,
      description: input.description,
      frequency: input.frequency,
      cron_expression: input.frequency === 'custom' ? input.cron_expression : cronExpression,
      handler: input.handler,
      payload: payloadStr,
      status: 'active',
      next_run_at: nextRunAt.toISOString(),
      run_count: 0,
      failure_count: 0,
      max_retries: input.max_retries ?? 3,
      timeout_seconds: input.timeout_seconds ?? 300,
      skip_missed: input.skip_missed ? 1 : 0,
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(
        `INSERT INTO scheduled_tasks (
          id, app_id, name, description, frequency, cron_expression,
          handler, payload, status, next_run_at, run_count, failure_count,
          max_retries, timeout_seconds, skip_missed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        task.id,
        task.app_id,
        task.name,
        task.description || null,
        task.frequency,
        task.cron_expression || null,
        task.handler,
        task.payload || null,
        task.status,
        task.next_run_at || null,
        task.run_count,
        task.failure_count,
        task.max_retries,
        task.timeout_seconds,
        task.skip_missed,
        task.created_at,
        task.updated_at
      )
      .run();

    return task;
  }

  /**
   * Get all tasks for an app
   */
  async getTasks(appId?: string): Promise<ScheduledTask[]> {
    const query = appId
      ? this.db.prepare('SELECT * FROM scheduled_tasks WHERE app_id = ? ORDER BY created_at DESC').bind(appId)
      : this.db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC');

    const result = await query.all<ScheduledTask>();
    return result.results || [];
  }

  /**
   * Get a single task by ID
   */
  async getTask(id: string): Promise<ScheduledTask | null> {
    const result = await this.db
      .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
      .bind(id)
      .first<ScheduledTask>();

    return result || null;
  }

  /**
   * Update a task
   */
  async updateTask(id: string, input: UpdateTaskInput): Promise<ScheduledTask | null> {
    const task = await this.getTask(id);
    if (!task) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.frequency !== undefined) {
      updates.push('frequency = ?');
      values.push(input.frequency);
      const cronExpression = getCronExpression(input.frequency, input.cron_expression);
      updates.push('cron_expression = ?');
      values.push(cronExpression);
      const nextRunAt = getNextRunTime(cronExpression);
      updates.push('next_run_at = ?');
      values.push(nextRunAt.toISOString());
    }
    if (input.handler !== undefined) {
      updates.push('handler = ?');
      values.push(input.handler);
    }
    if (input.payload !== undefined) {
      updates.push('payload = ?');
      values.push(JSON.stringify(input.payload));
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.max_retries !== undefined) {
      updates.push('max_retries = ?');
      values.push(input.max_retries);
    }
    if (input.timeout_seconds !== undefined) {
      updates.push('timeout_seconds = ?');
      values.push(input.timeout_seconds);
    }
    if (input.skip_missed !== undefined) {
      updates.push('skip_missed = ?');
      values.push(input.skip_missed ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    await this.db
      .prepare(`UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.getTask(id);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM scheduled_tasks WHERE id = ?')
      .bind(id)
      .run();

    return result.meta.changes > 0;
  }

  /**
   * Get tasks that are due to run with optimistic locking
   * @param appId - Optional app ID filter to only get tasks for specific app
   */
  async getDueTasks(appId?: string): Promise<ScheduledTask[]> {
    const now = new Date().toISOString();
    const lockId = crypto.randomUUID();
    const staleLockThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

    // Build query with optional app_id filter
    const appFilter = appId ? 'AND app_id = ?' : '';
    const selectQuery = `
      SELECT id FROM scheduled_tasks
      WHERE status = 'active'
      AND (next_run_at IS NULL OR next_run_at <= ?)
      AND (execution_lock_id IS NULL OR execution_locked_at < ?)
      ${appFilter}
      LIMIT ?
    `;

    // Acquire locks on due tasks using optimistic locking
    const updateStmt = this.db.prepare(
      `UPDATE scheduled_tasks
       SET execution_lock_id = ?,
           execution_locked_at = ?
       WHERE id IN (${selectQuery})`
    );

    // Bind parameters based on whether appId is provided
    const updateResult = appId
      ? await updateStmt.bind(lockId, now, now, staleLockThreshold, appId, this.config.maxTasksPerRun).run()
      : await updateStmt.bind(lockId, now, now, staleLockThreshold, this.config.maxTasksPerRun).run();

    // Skip fetching if no locks acquired (optimization)
    if (updateResult.meta.changes === 0) {
      return [];
    }

    // Fetch tasks we successfully locked
    const result = await this.db
      .prepare(
        `SELECT * FROM scheduled_tasks
         WHERE execution_lock_id = ?`
      )
      .bind(lockId)
      .all<ScheduledTask>();

    return result.results || [];
  }

  /**
   * Execute a task with retry logic and guaranteed lock release
   */
  async executeTask(task: ScheduledTask): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const logId = crypto.randomUUID();
    const now = new Date();
    const nowISO = now.toISOString();

    // Check if task should be skipped due to missed execution window
    if (task.skip_missed && task.next_run_at) {
      const nextRun = new Date(task.next_run_at);
      const missedBy = now.getTime() - nextRun.getTime();
      const tolerance = 5 * 60 * 1000; // 5 minutes tolerance

      if (missedBy > tolerance) {
        // Skip this execution and calculate next run
        const cronExpression = task.cron_expression || getCronExpression(task.frequency);
        const nextRunAt = getNextRunTime(cronExpression, now);

        await this.db
          .prepare(
            `UPDATE scheduled_tasks
             SET next_run_at = ?, execution_lock_id = NULL, execution_locked_at = NULL, updated_at = ?
             WHERE id = ?`
          )
          .bind(nextRunAt.toISOString(), nowISO, task.id)
          .run();

        return {
          success: true,
          output: { skipped: true, reason: 'Missed execution window' },
          executionTimeMs: Date.now() - startTime,
        };
      }
    }

    // Create log entry
    if (this.config.enableLogging) {
      await this.db
        .prepare(
          `INSERT INTO task_logs (id, task_id, started_at, status)
           VALUES (?, ?, ?, 'running')`
        )
        .bind(logId, task.id, nowISO)
        .run();
    }

    // Parse payload once and cache it
    const payload = task.payload ? JSON.parse(task.payload) : undefined;

    try {
      const handler = this.handlers[task.handler];
      if (!handler) {
        throw new Error(`Handler not found: ${task.handler}`);
      }

      const result = await handler(payload);

      const executionTime = Date.now() - startTime;
      const output = result && typeof result === 'object' && 'output' in result ? result.output : result;

      // Success: Calculate next regular run and release lock
      const cronExpression = task.cron_expression || getCronExpression(task.frequency);
      const nextRunAt = getNextRunTime(cronExpression, now);

      await this.db
        .prepare(
          `UPDATE scheduled_tasks
           SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1,
               failure_count = 0, execution_lock_id = NULL, execution_locked_at = NULL, updated_at = ?
           WHERE id = ?`
        )
        .bind(nowISO, nextRunAt.toISOString(), nowISO, task.id)
        .run();

      // Update log
      if (this.config.enableLogging) {
        await this.db
          .prepare(
            `UPDATE task_logs
             SET completed_at = ?, status = 'success', execution_time_ms = ?, output = ?
             WHERE id = ?`
          )
          .bind(
            new Date().toISOString(),
            executionTime,
            output ? JSON.stringify(output) : null,
            logId
          )
          .run();
      }

      return {
        success: true,
        output,
        executionTimeMs: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Calculate if we should retry or mark as failed
      const newFailureCount = task.failure_count + 1;
      const shouldRetry = newFailureCount < task.max_retries;

      // Determine next_run_at based on retry logic
      let nextRunAt: string;
      let newStatus: string = task.status;

      if (shouldRetry) {
        // Schedule retry after delay
        const retryTime = new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000);
        nextRunAt = retryTime.toISOString();
      } else {
        // Max retries reached - mark as failed and stop scheduling
        newStatus = 'failed';
        nextRunAt = task.next_run_at || nowISO; // Keep current or set to now
      }

      // Update task with retry logic and guaranteed lock release
      await this.db
        .prepare(
          `UPDATE scheduled_tasks
           SET failure_count = failure_count + 1,
               next_run_at = ?,
               status = ?,
               updated_at = ?,
               execution_lock_id = NULL,
               execution_locked_at = NULL
           WHERE id = ?`
        )
        .bind(nextRunAt, newStatus, new Date().toISOString(), task.id)
        .run();

      // Update log
      if (this.config.enableLogging) {
        await this.db
          .prepare(
            `UPDATE task_logs
             SET completed_at = ?, status = 'failed', error_message = ?, execution_time_ms = ?
             WHERE id = ?`
          )
          .bind(new Date().toISOString(), errorMessage, executionTime, logId)
          .run();
      }

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: executionTime,
      };
    }
  }

  /**
   * Run all due tasks in parallel for better performance
   * @param appId - Optional app ID filter to only run tasks for specific app
   */
  async runDueTasks(appId?: string): Promise<TaskExecutionResult[]> {
    const tasks = await this.getDueTasks(appId);

    // Early exit if no tasks (optimization)
    if (tasks.length === 0) {
      return [];
    }

    // Execute all tasks in parallel using Promise.allSettled
    // This prevents one slow/failing task from blocking others
    const results = await Promise.allSettled(
      tasks.map(task => this.executeTask(task))
    );

    // Convert PromiseSettledResult to TaskExecutionResult
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // If executeTask itself throws (shouldn't happen as we catch errors inside),
        // return a failed result
        return {
          success: false,
          error: `Task execution failed: ${result.reason}`,
          executionTimeMs: 0,
        };
      }
    });
  }

  /**
   * Get task logs
   */
  async getTaskLogs(taskId: string, limit = 50): Promise<TaskLog[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM task_logs
         WHERE task_id = ?
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .bind(taskId, limit)
      .all<TaskLog>();

    return result.results || [];
  }

  /**
   * Clean up old task logs to prevent unbounded growth
   * @param daysToKeep - Number of days of logs to retain (default: 30)
   * @returns Number of logs deleted
   */
  async cleanupOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const cutoffISO = cutoffDate.toISOString();

    const result = await this.db
      .prepare(
        `DELETE FROM task_logs
         WHERE started_at < ?`
      )
      .bind(cutoffISO)
      .run();

    return result.meta.changes;
  }

  /**
   * Register a task handler
   */
  registerHandler(name: string, handler: (payload?: unknown) => Promise<TaskExecutionResult | void>): void {
    this.handlers[name] = handler;
  }

  /**
   * Trigger a task manually
   */
  async triggerTask(id: string): Promise<TaskExecutionResult> {
    const task = await this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    return this.executeTask(task);
  }
}

/**
 * Create a scheduler instance
 */
export function createScheduler(db: D1Database, config?: SchedulerConfig): Scheduler {
  return new Scheduler(db, config);
}
