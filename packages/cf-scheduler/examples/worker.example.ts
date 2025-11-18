/**
 * Example Cloudflare Worker with scheduled task support
 *
 * Configure in wrangler.toml:
 *
 * [triggers]
 * crons = ["* * * * *"]  # Run every minute
 *
 * [[d1_databases]]
 * binding = "DB"
 * database_name = "my-database"
 * database_id = "your-database-id"
 */

import { createCronHandler } from '@ottabase/cf-scheduler/server';

interface Env {
  DB: D1Database;
}

// Define your task handlers
const handlers = {
  'send-email': async (payload?: unknown) => {
    console.log('Sending email with payload:', payload);

    // Your email sending logic here
    await sendEmail(payload);

    return {
      success: true,
      output: { sent: true },
    };
  },

  'cleanup-database': async () => {
    console.log('Running database cleanup...');

    // Your cleanup logic here
    const deletedCount = await cleanupOldRecords();

    return {
      success: true,
      output: { deletedRecords: deletedCount },
    };
  },

  'generate-report': async (payload?: unknown) => {
    console.log('Generating report:', payload);

    // Your report generation logic
    const report = await generateReport(payload);

    return {
      success: true,
      output: report,
    };
  },
};

export default {
  // Regular fetch handler for API requests
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Your API logic here
    if (url.pathname === '/api/health') {
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },

  // Scheduled cron handler
  scheduled: createCronHandler({
    database: env.DB,
    handlers,
    verbose: true, // Enable detailed logging
    maxTasksPerRun: 10, // Process up to 10 tasks per run
    enableLogging: true, // Save execution logs to database
  }),
};

// Example helper functions (implement these based on your needs)
async function sendEmail(payload: unknown) {
  // Email sending implementation
}

async function cleanupOldRecords(): Promise<number> {
  // Database cleanup implementation
  return 0;
}

async function generateReport(payload: unknown) {
  // Report generation implementation
  return { status: 'generated' };
}
