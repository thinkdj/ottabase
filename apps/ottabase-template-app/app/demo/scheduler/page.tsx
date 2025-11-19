'use client';

import { useState, useEffect } from 'react';
import type { ScheduledTask, TaskLog, ScheduleFrequency } from '@ottabase/cf-scheduler';
import { FREQUENCY_LABELS } from '@ottabase/cf-scheduler';

export default function SchedulerDemoPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Debounce state: track last trigger time per task
  const [lastTriggerTimes, setLastTriggerTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    initializeAndLoadTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      loadTaskLogs(selectedTask.id);
    }
  }, [selectedTask]);

  const initializeAndLoadTasks = async () => {
    try {
      setLoading(true);
      // Initialize database schema
      await fetch('/api/scheduler/init', { method: 'POST' });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/scheduler/tasks');
      if (!response.ok) throw new Error('Failed to load tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    }
  };

  const loadTaskLogs = async (taskId: string) => {
    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}/logs`);
      if (!response.ok) throw new Error('Failed to load logs');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setLogs([]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cronExpression = formData.get('cron_expression') as string;

    try {
      setLoading(true);
      const response = await fetch('/api/scheduler/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: 'demo-app',
          name: formData.get('name'),
          description: formData.get('description'),
          frequency: cronExpression ? 'custom' : formData.get('frequency'),
          cron_expression: cronExpression || undefined,
          handler: formData.get('handler'),
          payload: formData.get('payload')
            ? JSON.parse(formData.get('payload') as string)
            : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');
      await loadTasks();
      setShowCreateModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (task: ScheduledTask) => {
    try {
      setLoading(true);
      const newStatus = task.status === 'active' ? 'paused' : 'active';
      const response = await fetch(`/api/scheduler/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update task');
      await loadTasks();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerTask = async (taskId: string) => {
    // Debounce: prevent rapid triggers (2 second cooldown)
    const now = Date.now();
    const lastTrigger = lastTriggerTimes[taskId] || 0;
    const cooldownMs = 2000; // 2 seconds

    if (now - lastTrigger < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastTrigger);
      setError(`Please wait ${Math.ceil(remainingMs / 1000)}s before triggering again`);
      return;
    }

    try {
      setLoading(true);
      setLastTriggerTimes(prev => ({ ...prev, [taskId]: now }));

      const response = await fetch(`/api/scheduler/tasks/${taskId}/trigger`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to trigger task');
      await loadTasks();
      if (selectedTask?.id === taskId) {
        await loadTaskLogs(taskId);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger task');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/scheduler/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');
      await loadTasks();
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
        setLogs([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <div className="mx-auto max-w-7xl p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Task Scheduler
          </h1>
          <p className="text-gray-600">
            Manage automated tasks with database-driven scheduling
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Tasks List */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Scheduled Tasks
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={loading}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
              >
                New Task
              </button>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
                  <p className="mb-4 text-sm text-gray-500">
                    No scheduled tasks yet
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-sm text-gray-900 underline hover:text-gray-700"
                  >
                    Create your first task
                  </button>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`cursor-pointer rounded-lg border bg-white p-4 transition-all hover:shadow-md ${
                      selectedTask?.id === task.id
                        ? 'border-gray-900 shadow-sm'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {task.name}
                        </h3>
                        {task.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusColor(task.status)}`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {FREQUENCY_LABELS[task.frequency as ScheduleFrequency]}
                      </span>
                      <span>Runs: {task.run_count}</span>
                      {task.failure_count > 0 && (
                        <span className="text-red-600">
                          Failures: {task.failure_count}
                        </span>
                      )}
                    </div>

                    {task.next_run_at && (
                      <div className="mt-2 text-xs text-gray-500">
                        Next run:{' '}
                        {new Date(task.next_run_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Task Details & Logs */}
          <div className="lg:col-span-1">
            {selectedTask ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-semibold text-gray-900">
                    Task Details
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Handler:</span>
                      <p className="font-mono text-gray-900">
                        {selectedTask.handler}
                      </p>
                    </div>

                    {selectedTask.payload && (
                      <div>
                        <span className="text-gray-500">Payload:</span>
                        <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                          {JSON.stringify(
                            JSON.parse(selectedTask.payload),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p className="text-gray-900">
                        {new Date(selectedTask.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleToggleStatus(selectedTask)}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      {selectedTask.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleTriggerTask(selectedTask.id)}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={() => handleDeleteTask(selectedTask.id)}
                      disabled={loading}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:bg-gray-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Execution Logs */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-semibold text-gray-900">
                    Execution History
                  </h3>

                  {logs.length === 0 ? (
                    <p className="text-sm text-gray-500">No executions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded border border-gray-200 p-2 text-xs"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span
                              className={`font-medium ${
                                log.status === 'success'
                                  ? 'text-green-600'
                                  : log.status === 'failed'
                                    ? 'text-red-600'
                                    : 'text-yellow-600'
                              }`}
                            >
                              {log.status}
                            </span>
                            {log.execution_time_ms && (
                              <span className="text-gray-500">
                                {log.execution_time_ms}ms
                              </span>
                            )}
                          </div>
                          <div className="text-gray-600">
                            {new Date(log.started_at).toLocaleString()}
                          </div>
                          {log.error_message && (
                            <div className="mt-1 text-red-600">
                              {log.error_message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-500">
                  Select a task to view details
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Create Task Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Create Scheduled Task
              </h2>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Task Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    placeholder="e.g., Send Daily Report"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    name="description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    placeholder="Brief description of the task"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    App Name (optional)
                  </label>
                  <input
                    type="text"
                    name="app_id"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    placeholder="default"
                    defaultValue="default"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Group tasks by app (useful when sharing DB across apps)
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Frequency
                  </label>
                  <select
                    name="frequency"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  >
                    <option value="every_minute">Every Minute</option>
                    <option value="every_5_minutes">Every 5 Minutes</option>
                    <option value="every_15_minutes">Every 15 Minutes</option>
                    <option value="every_30_minutes">Every 30 Minutes</option>
                    <option value="hourly">Hourly</option>
                    <option value="every_6_hours">Every 6 Hours</option>
                    <option value="daily">Daily (midnight UTC)</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    For specific times like "daily at 1:00 AM", use cron expression below
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Custom Cron Expression (optional)
                  </label>
                  <input
                    type="text"
                    name="cron_expression"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-400 focus:outline-none"
                    placeholder="e.g., 0 1 * * * (daily at 1:00 AM)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Examples: "0 1 * * *" (1 AM daily), "0 9,17 * * 1-5" (9 AM & 5 PM weekdays)
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Handler Function
                  </label>
                  <select
                    name="handler"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  >
                    <option value="">Select a handler...</option>
                    <option value="demo-task">demo-task</option>
                    <option value="send-summary-email">send-summary-email</option>
                    <option value="send-notifications">send-notifications</option>
                    <option value="cleanup-task">cleanup-task</option>
                    <option value="database-backup">database-backup</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Registered handler to execute
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Payload (JSON, optional)
                  </label>
                  <textarea
                    name="payload"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-400 focus:outline-none"
                    placeholder='{"key": "value"}'
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Implementation Notes */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Implementation Notes
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Database-driven task scheduling with D1</li>
            <li>• Supports common frequencies and custom cron expressions</li>
            <li>• Automatic retry logic for failed tasks</li>
            <li>• Execution logging and performance tracking</li>
            <li>• Cloudflare Workers cron integration</li>
            <li>• Full TypeScript support with type safety</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
