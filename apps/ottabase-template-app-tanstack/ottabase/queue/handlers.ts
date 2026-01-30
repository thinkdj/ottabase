/**
 * Queue Handlers
 *
 * Define your app-specific job handlers here.
 * Each handler processes a specific job type from the queue.
 *
 * @example
 * ```ts
 * // In your worker, dispatch a job:
 * await dispatch(env.OBCF_QUEUE, "send-email", {
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   template: "welcome",
 * });
 * ```
 */

import type { JobHandler } from '@ottabase/queue';
import type { CloudflareEnv } from '../../cloudflare-env';

/**
 * Email job payload
 */
export interface SendEmailPayload {
    to: string;
    subject: string;
    body?: string;
    template?: string;
    data?: Record<string, unknown>;
}

/**
 * Send email handler
 * Processes email jobs from the queue
 */
export const sendEmailHandler: JobHandler<SendEmailPayload, CloudflareEnv> = async (job, ctx) => {
    const { to, subject, body, template, data } = job.payload;

    console.log(`[Queue:send-email] Processing email to ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Template: ${template || 'none'}`);
    console.log(`  Attempt: ${ctx.attempt}`);

    // TODO: Implement actual email sending using @ottabase/email
    // Example:
    // const mailer = createResendMailer({ apiKey: ctx.env.RESEND_API_KEY });
    // await mailer.send({ to, subject, html: body });

    // For demo purposes, just log
    console.log(`[Queue:send-email] Email sent successfully to ${to}`);
};

/**
 * Process order job payload
 */
export interface ProcessOrderPayload {
    orderId: string | number;
    userId?: string;
    items?: Array<{ id: string; quantity: number }>;
}

/**
 * Process order handler
 * Handles order processing tasks
 */
export const processOrderHandler: JobHandler<ProcessOrderPayload, CloudflareEnv> = async (job, ctx) => {
    const { orderId, userId, items } = job.payload;

    console.log(`[Queue:process-order] Processing order ${orderId}`);
    console.log(`  User: ${userId || 'guest'}`);
    console.log(`  Items: ${items?.length || 0}`);
    console.log(`  Attempt: ${ctx.attempt}`);

    // TODO: Implement actual order processing
    // Example:
    // const db = createDrizzle(ctx.env.OBCF_DB);
    // await db.update(orders).set({ status: "processing" }).where(eq(orders.id, orderId));

    console.log(`[Queue:process-order] Order ${orderId} processed successfully`);
};

/**
 * Generate report job payload
 */
export interface GenerateReportPayload {
    reportType: string;
    userId?: string;
    params?: Record<string, unknown>;
}

/**
 * Generate report handler
 * Creates reports asynchronously
 */
export const generateReportHandler: JobHandler<GenerateReportPayload, CloudflareEnv> = async (job, ctx) => {
    const { reportType, userId, params } = job.payload;

    console.log(`[Queue:generate-report] Generating ${reportType} report`);
    console.log(`  User: ${userId || 'system'}`);
    console.log(`  Params: ${JSON.stringify(params || {})}`);
    console.log(`  Attempt: ${ctx.attempt}`);

    // TODO: Implement actual report generation
    // Example:
    // const report = await generateReport(reportType, params);
    // await saveToR2(ctx.env.OBCF_R2, `reports/${reportType}-${Date.now()}.pdf`, report);

    console.log(`[Queue:generate-report] Report ${reportType} generated successfully`);
};

/**
 * Sync data job payload
 */
export interface SyncDataPayload {
    source: string;
    target: string;
    entityType?: string;
    entityIds?: string[];
}

/**
 * Sync data handler
 * Synchronizes data between systems
 */
export const syncDataHandler: JobHandler<SyncDataPayload, CloudflareEnv> = async (job, ctx) => {
    const { source, target, entityType, entityIds } = job.payload;

    console.log(`[Queue:sync-data] Syncing from ${source} to ${target}`);
    console.log(`  Entity type: ${entityType || 'all'}`);
    console.log(`  Entity IDs: ${entityIds?.length || 'all'}`);
    console.log(`  Attempt: ${ctx.attempt}`);

    // TODO: Implement actual data synchronization

    console.log(`[Queue:sync-data] Sync completed successfully`);
};

/**
 * Batch task job payload (for demo)
 */
export interface BatchTaskPayload {
    userId?: string;
    taskNumber?: number;
    action?: string;
    data?: unknown;
}

/**
 * Batch task handler
 * Handles batch tasks from the demo
 */
export const batchTaskHandler: JobHandler<BatchTaskPayload, CloudflareEnv> = async (job, ctx) => {
    const { userId, taskNumber, action, data } = job.payload;

    console.log(`[Queue:batch-task] Processing batch task`);
    console.log(`  User: ${userId || 'unknown'}`);
    console.log(`  Task #: ${taskNumber || 'N/A'}`);
    console.log(`  Action: ${action || 'batch-task'}`);
    console.log(`  Data: ${JSON.stringify(data || {})}`);
    console.log(`  Attempt: ${ctx.attempt}`);

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`[Queue:batch-task] Task completed`);
};
