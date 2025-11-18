/**
 * Usage examples for @ottabase/cf-scheduler
 */

import { createScheduler } from '@ottabase/cf-scheduler/server';
import { createSchedulerClient } from '@ottabase/cf-scheduler/client';
import type { CreateTaskInput } from '@ottabase/cf-scheduler';

// ============================================
// Server-side usage
// ============================================

// Example 1: Basic scheduler setup
async function setupScheduler(db: D1Database) {
  const scheduler = createScheduler(db);

  // Initialize database (run once)
  await scheduler.initializeSchema();

  // Create a simple task
  const task = await scheduler.createTask({
    app_id: 'my-app',
    name: 'Daily Backup',
    description: 'Backup database daily at midnight',
    frequency: 'daily',
    handler: 'backup-database',
  });

  console.log('Created task:', task.id);
}

// Example 2: Task with payload and custom settings
async function createAdvancedTask(db: D1Database) {
  const scheduler = createScheduler(db);

  await scheduler.createTask({
    app_id: 'my-app',
    name: 'Send Notifications',
    description: 'Send push notifications to users',
    frequency: 'every_15_minutes',
    handler: 'send-notifications',
    payload: {
      type: 'push',
      targets: ['ios', 'android'],
      priority: 'high',
    },
    max_retries: 5,
    timeout_seconds: 60,
  });
}

// Example 3: Custom cron expression
async function createCustomSchedule(db: D1Database) {
  const scheduler = createScheduler(db);

  await scheduler.createTask({
    app_id: 'my-app',
    name: 'Business Hours Report',
    frequency: 'custom',
    cron_expression: '0 9,17 * * 1-5', // 9 AM and 5 PM on weekdays
    handler: 'generate-report',
  });
}

// Example 4: Register and execute handlers
async function handleTasks(db: D1Database) {
  const scheduler = createScheduler(db, {
    handlers: {
      'backup-database': async (payload) => {
        console.log('Backing up database...');
        // Your backup logic
        return { success: true, output: { backed_up: true } };
      },

      'send-notifications': async (payload) => {
        const config = payload as { type: string; targets: string[] };
        console.log('Sending notifications:', config);
        // Your notification logic
        return { success: true, output: { sent: 100 } };
      },
    },
  });

  // Manually trigger a task
  const result = await scheduler.triggerTask('task-id-here');
  console.log('Task result:', result);
}

// Example 5: Managing tasks
async function manageTasks(db: D1Database) {
  const scheduler = createScheduler(db);

  // List all tasks
  const allTasks = await scheduler.getTasks();
  console.log('All tasks:', allTasks.length);

  // Get tasks for specific app
  const appTasks = await scheduler.getTasks('my-app');

  // Update a task
  await scheduler.updateTask('task-id', {
    status: 'paused',
    frequency: 'hourly',
  });

  // Delete a task
  await scheduler.deleteTask('task-id');

  // Get execution logs
  const logs = await scheduler.getTaskLogs('task-id', 50);
  console.log('Recent executions:', logs.length);
}

// ============================================
// Client-side usage
// ============================================

// Example 1: Basic client setup
async function useSchedulerClient() {
  const client = createSchedulerClient({
    baseUrl: '/api/scheduler',
  });

  // Get all tasks
  const tasks = await client.getTasks();
  console.log('Tasks:', tasks);

  // Create a task
  const newTask = await client.createTask({
    app_id: 'my-app',
    name: 'Weekly Report',
    frequency: 'weekly',
    handler: 'generate-report',
  });

  console.log('Created:', newTask.id);
}

// Example 2: Task management from client
async function manageTasksFromClient() {
  const client = createSchedulerClient();

  // Get specific task
  const task = await client.getTask('task-id');

  // Update task
  await client.updateTask('task-id', {
    name: 'Updated Task Name',
    frequency: 'daily',
  });

  // Pause/resume
  await client.pauseTask('task-id');
  await client.resumeTask('task-id');

  // Trigger manually
  await client.triggerTask('task-id');

  // Get logs
  const logs = await client.getTaskLogs('task-id');
  console.log('Execution logs:', logs);

  // Delete task
  await client.deleteTask('task-id');
}

// Example 3: React component usage
function SchedulerComponent() {
  const [tasks, setTasks] = React.useState([]);
  const client = createSchedulerClient();

  React.useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const data = await client.getTasks('my-app');
    setTasks(data);
  }

  async function handleCreateTask(input: CreateTaskInput) {
    await client.createTask(input);
    await loadTasks();
  }

  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id}>
          <h3>{task.name}</h3>
          <button onClick={() => client.triggerTask(task.id)}>
            Run Now
          </button>
        </div>
      ))}
    </div>
  );
}
