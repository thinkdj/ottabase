/**
 * Example: Daily email summary at 1:00 AM
 *
 * This example shows how to:
 * 1. Register a custom email handler
 * 2. Create a daily scheduled task with specific time
 * 3. Pass metadata/parameters to the handler
 * 4. Set up Cloudflare Workers to run the scheduler
 */

import { createScheduler } from '@ottabase/cf-scheduler/server';
import { createCronHandler } from '@ottabase/cf-scheduler/server';

interface Env {
  DB: D1Database;
  // Your email service binding (e.g., SendGrid, Resend, etc.)
  EMAIL_API_KEY: string;
}

// ============================================
// Step 1: Define your custom email handler
// ============================================

async function sendSummaryEmail(payload: {
  recipients: string[];
  subject: string;
  template: string;
  data?: Record<string, unknown>;
}) {
  console.log('Sending summary email to:', payload.recipients);

  // Your email sending logic here
  // This could use SendGrid, Resend, Mailgun, etc.
  try {
    // Example: Fetch data for the summary
    const summaryData = await fetchDailySummary();

    // Send email via your email service
    await sendEmail({
      to: payload.recipients,
      subject: payload.subject,
      template: payload.template,
      data: {
        ...payload.data,
        summary: summaryData,
      },
    });

    return {
      success: true,
      output: {
        sent: payload.recipients.length,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// ============================================
// Step 2: Register the handler with scheduler
// ============================================

export default {
  // Cloudflare Workers cron handler
  // Configure in wrangler.toml: crons = ["* * * * *"]
  scheduled: createCronHandler({
    database: env.DB,
    handlers: {
      // Register your custom handler
      'send-summary-email': async (payload) => {
        return sendSummaryEmail(payload as any);
      },

      // You can register multiple handlers
      'send-welcome-email': async (payload) => {
        // Another email handler
        return { success: true };
      },

      'cleanup-old-data': async () => {
        // Non-email handler
        return { success: true };
      },
    },
    verbose: true,
    maxTasksPerRun: 20,
    enableLogging: true,
  }),

  // API endpoint to create the scheduled task
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Initialize scheduler
    if (url.pathname === '/api/scheduler/setup' && request.method === 'POST') {
      const scheduler = createScheduler(env.DB);

      // Initialize database schema
      await scheduler.initializeSchema();

      // ============================================
      // Step 3: Create the daily 1:00 AM email task
      // ============================================
      const task = await scheduler.createTask({
        app_id: 'my-app',
        name: 'Send Daily Summary Email',
        description: 'Send summary email to all users every day at 1:00 AM',

        // Use custom cron expression for specific time
        frequency: 'custom',
        cron_expression: '0 1 * * *', // Every day at 1:00 AM (UTC)

        // Handler name (must match registered handler)
        handler: 'send-summary-email',

        // Payload with email parameters
        payload: {
          recipients: ['user@example.com', 'admin@example.com'],
          subject: 'Your Daily Summary',
          template: 'daily-summary',
          data: {
            type: 'daily',
            timezone: 'UTC',
          },
        },

        // Optional: Retry configuration
        max_retries: 3,
        timeout_seconds: 300, // 5 minutes
      });

      return new Response(JSON.stringify({
        success: true,
        task: {
          id: task.id,
          next_run: task.next_run_at,
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};

// ============================================
// Helper functions (implement based on your needs)
// ============================================

async function fetchDailySummary() {
  // Fetch data from your database
  return {
    totalUsers: 1000,
    newSignups: 50,
    revenue: '$10,000',
    topProducts: ['Product A', 'Product B'],
  };
}

async function sendEmail(options: {
  to: string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
}) {
  // Implement your email sending logic
  // Example with fetch to SendGrid, Resend, etc.
  console.log('Sending email:', options);
}

// ============================================
// Other time-based examples
// ============================================

// Every weekday at 9:00 AM
const weekdayMorning = {
  frequency: 'custom' as const,
  cron_expression: '0 9 * * 1-5', // Mon-Fri at 9 AM
};

// Every Monday at 8:00 AM
const weeklyMonday = {
  frequency: 'custom' as const,
  cron_expression: '0 8 * * 1', // Monday at 8 AM
};

// First day of month at 10:00 AM
const monthlyFirst = {
  frequency: 'custom' as const,
  cron_expression: '0 10 1 * *', // 1st of month at 10 AM
};

// Every 6 hours
const every6Hours = {
  frequency: 'every_6_hours' as const,
  // No cron_expression needed for predefined frequencies
};
