/**
 * Client-side utilities for interacting with the scheduler
 */

import type { ScheduledTask, CreateTaskInput, UpdateTaskInput, TaskLog } from '../types';

export interface SchedulerClientConfig {
  /**
   * Base API URL for scheduler endpoints
   */
  baseUrl?: string;
}

/**
 * Client for managing scheduled tasks
 */
export class SchedulerClient {
  private baseUrl: string;

  constructor(config: SchedulerClientConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/scheduler';
  }

  /**
   * Get all tasks
   */
  async getTasks(appId?: string): Promise<ScheduledTask[]> {
    const url = appId ? `${this.baseUrl}/tasks?app_id=${appId}` : `${this.baseUrl}/tasks`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    const data = await response.json();
    return data.tasks || [];
  }

  /**
   * Get a single task
   */
  async getTask(id: string): Promise<ScheduledTask> {
    const response = await fetch(`${this.baseUrl}/tasks/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch task');
    }
    const data = await response.json();
    return data.task;
  }

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<ScheduledTask> {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error('Failed to create task');
    }
    const data = await response.json();
    return data.task;
  }

  /**
   * Update a task
   */
  async updateTask(id: string, input: UpdateTaskInput): Promise<ScheduledTask> {
    const response = await fetch(`${this.baseUrl}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error('Failed to update task');
    }
    const data = await response.json();
    return data.task;
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tasks/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete task');
    }
  }

  /**
   * Trigger a task manually
   */
  async triggerTask(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tasks/${id}/trigger`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to trigger task');
    }
  }

  /**
   * Get task logs
   */
  async getTaskLogs(taskId: string): Promise<TaskLog[]> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/logs`);
    if (!response.ok) {
      throw new Error('Failed to fetch task logs');
    }
    const data = await response.json();
    return data.logs || [];
  }

  /**
   * Pause a task
   */
  async pauseTask(id: string): Promise<ScheduledTask> {
    return this.updateTask(id, { status: 'paused' });
  }

  /**
   * Resume a task
   */
  async resumeTask(id: string): Promise<ScheduledTask> {
    return this.updateTask(id, { status: 'active' });
  }
}

/**
 * Create a scheduler client
 */
export function createSchedulerClient(config?: SchedulerClientConfig): SchedulerClient {
  return new SchedulerClient(config);
}
