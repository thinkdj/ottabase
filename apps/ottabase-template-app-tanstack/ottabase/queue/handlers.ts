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
import { createResendMailer } from '@ottabase/email/providers/resend';
import { createSESMailer } from '@ottabase/email/providers/ses';
import { sendTemplatedEmail } from '@ottabase/email/mailer';
import type { Mailer } from '@ottabase/email';

function getMailer(env: CloudflareEnv): { mailer: Mailer | null; from: string } {
    const from = (env as any).EMAIL_FROM || 'noreply@example.com';
    if ((env as any).EMAIL_RESEND_API_KEY) {
        return { mailer: createResendMailer({ apiKey: (env as any).EMAIL_RESEND_API_KEY }), from };
    }
    if ((env as any).AWS_ACCESS_KEY_ID && (env as any).AWS_SECRET_ACCESS_KEY) {
        return {
            mailer: createSESMailer({
                accessKeyId: (env as any).AWS_ACCESS_KEY_ID,
                secretAccessKey: (env as any).AWS_SECRET_ACCESS_KEY,
                region: (env as any).AWS_REGION || 'us-east-1',
            }),
            from,
        };
    }
    return { mailer: null, from };
}

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
 * Sends emails via configured provider (Resend, SES, etc.)
 */
export const sendEmailHandler: JobHandler<SendEmailPayload, CloudflareEnv> = async (job, ctx) => {
    const { to, subject, body, template, data } = job.payload;
    const { mailer, from } = getMailer(ctx.env);

    if (!mailer) {
        console.warn(`[Queue:send-email] No email provider configured, skipping email to ${to}`);
        return;
    }

    if (template) {
        await sendTemplatedEmail(mailer, {
            from,
            to,
            template,
            subject,
            variables: data,
            content: { body: body || '' },
        });
    } else {
        await mailer.send({ from, to, subject, html: body || '' });
    }

    console.log(`[Queue:send-email] Email sent to ${to}`);
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
    console.log(`[Queue:process-order] Processing order ${orderId} (${items?.length || 0} items)`);

    const status = {
        status: 'processed',
        userId,
        itemCount: items?.length || 0,
        processedAt: new Date().toISOString(),
    };

    if (ctx.env.OBCF_KV) {
        await ctx.env.OBCF_KV.put(`order:${orderId}:status`, JSON.stringify(status), { expirationTtl: 86400 * 30 });
    }

    console.log(`[Queue:process-order] Order ${orderId} processed`);
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

    const report = JSON.stringify(
        { reportType, generatedBy: userId || 'system', generatedAt: new Date().toISOString(), params },
        null,
        2,
    );

    if (ctx.env.OBCF_R2) {
        const key = `reports/${reportType}-${Date.now()}.json`;
        await ctx.env.OBCF_R2.put(key, report);
        console.log(`[Queue:generate-report] Stored at ${key}`);
    }

    console.log(`[Queue:generate-report] Report ${reportType} generated`);
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
    console.log(`[Queue:sync-data] Syncing ${entityType || 'all'} from ${source} to ${target}`);

    const status = {
        status: 'completed',
        entityType,
        count: entityIds?.length || 0,
        syncedAt: new Date().toISOString(),
    };

    if (ctx.env.OBCF_KV) {
        await ctx.env.OBCF_KV.put(`sync:${source}:${target}:status`, JSON.stringify(status), {
            expirationTtl: 86400 * 7,
        });
    }

    console.log(`[Queue:sync-data] Sync completed`);
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
