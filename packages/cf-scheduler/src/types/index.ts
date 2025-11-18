/**
 * Task scheduler types for database-driven cron jobs
 */

/**
 * Frequency type for scheduled tasks
 */
export type ScheduleFrequency =
  | 'every_minute'
  | 'every_5_minutes'
  | 'every_10_minutes'
  | 'every_15_minutes'
  | 'every_30_minutes'
  | 'hourly'
  | 'every_2_hours'
  | 'every_4_hours'
  | 'every_6_hours'
  | 'every_12_hours'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

/**
 * Status of a scheduled task
 */
export type TaskStatus = 'active' | 'paused' | 'completed' | 'failed';

/**
 * Scheduled task stored in D1
 */
export interface ScheduledTask {
  id: string;
  app_id: string;
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  cron_expression?: string; // For custom schedules
  handler: string; // Function name or path to execute
  payload?: string; // JSON string for task data
  status: TaskStatus;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  failure_count: number;
  max_retries: number;
  timeout_seconds: number;
  skip_missed: number; // Boolean as INTEGER (0 or 1) - skip execution if missed
  execution_lock_id?: string; // Lock ID for preventing concurrent execution
  execution_locked_at?: string; // When the lock was acquired
  created_at: string;
  updated_at: string;
}

/**
 * Task execution log entry
 */
export interface TaskLog {
  id: string;
  task_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'failed';
  error_message?: string;
  execution_time_ms?: number;
  output?: string;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}

/**
 * Handler function type for scheduled tasks
 */
export type TaskHandler = (
  payload?: unknown
) => Promise<TaskExecutionResult | void>;

/**
 * Task handler registry
 */
export interface TaskHandlerRegistry {
  [key: string]: TaskHandler;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /**
   * D1 database binding name
   */
  databaseBindingName?: string;

  /**
   * Maximum number of tasks to run per execution
   */
  maxTasksPerRun?: number;

  /**
   * Whether to log task executions
   */
  enableLogging?: boolean;

  /**
   * Task handlers registry
   */
  handlers?: TaskHandlerRegistry;
}

/**
 * Create task input
 */
export interface CreateTaskInput {
  app_id: string;
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  handler: string;
  payload?: unknown;
  max_retries?: number;
  timeout_seconds?: number;
  skip_missed?: boolean; // Skip execution if time has passed
}

/**
 * Update task input
 */
export interface UpdateTaskInput {
  name?: string;
  description?: string;
  frequency?: ScheduleFrequency;
  cron_expression?: string;
  handler?: string;
  payload?: unknown;
  status?: TaskStatus;
  max_retries?: number;
  timeout_seconds?: number;
  skip_missed?: boolean;
}

/**
 * Frequency to cron expression mapping
 */
export const FREQUENCY_CRON_MAP: Record<Exclude<ScheduleFrequency, 'custom'>, string> = {
  every_minute: '* * * * *',
  every_5_minutes: '*/5 * * * *',
  every_10_minutes: '*/10 * * * *',
  every_15_minutes: '*/15 * * * *',
  every_30_minutes: '*/30 * * * *',
  hourly: '0 * * * *',
  every_2_hours: '0 */2 * * *',
  every_4_hours: '0 */4 * * *',
  every_6_hours: '0 */6 * * *',
  every_12_hours: '0 */12 * * *',
  daily: '0 0 * * *',
  weekly: '0 0 * * 0',
  monthly: '0 0 1 * *',
};

/**
 * Frequency display names
 */
export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  every_minute: 'Every Minute',
  every_5_minutes: 'Every 5 Minutes',
  every_10_minutes: 'Every 10 Minutes',
  every_15_minutes: 'Every 15 Minutes',
  every_30_minutes: 'Every 30 Minutes',
  hourly: 'Hourly',
  every_2_hours: 'Every 2 Hours',
  every_4_hours: 'Every 4 Hours',
  every_6_hours: 'Every 6 Hours',
  every_12_hours: 'Every 12 Hours',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};
