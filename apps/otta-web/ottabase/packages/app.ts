// ============================================================
// app — this application's own tables, routes and jobs, as a package
// ============================================================
// Everything that is otta-web's rather than a framework package's lives here: the demo
// Todo model, the PDF export route, and the demo queue jobs with the cron
// handlers that dispatch them. A new app feature with a table and a route is one more entry
// in this manifest, not four edits across the app.
// ============================================================

import type { BrowserWorker } from '@cloudflare/puppeteer';
import { CF_PDF_BASE_PATH, DEFAULT_PDF_RESOURCE_ORIGINS } from '@ottabase/cf-pdf';
import { createCfPdfRequestHandler } from '@ottabase/cf-pdf/router';
import { definePackage, type CronContribution } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { dispatch } from '@ottabase/queue';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import { Todo, todosTable } from '../models/Todo'; // otta:only demo
import { incrementDispatchStats } from '../queue';
import {
    batchTaskHandler,
    generateReportHandler,
    processOrderHandler,
    sendEmailHandler,
    syncDataHandler,
    type BatchTaskPayload,
    type GenerateReportPayload,
    type ProcessOrderPayload,
    type SendEmailPayload,
    type SyncDataPayload,
} from '../queue/handlers';

// ── PDF export ──────────────────────────────────────────────────────────────
// The package owns the request contract and render policy; this host adapter owns verified
// sessions, the Browser Rendering binding, and the app's rate-limit policy.
const handleCfPdfRequest = createCfPdfRequestHandler<CloudflareEnv>({
    resolveCaller: async (request, env) => {
        const [{ getSession }, { getAuthOptions }] = await Promise.all([
            import('@ottabase/auth/backend'),
            import('../../worker/lib/auth-utils'),
        ]);
        const session = await getSession(request, env as never, getAuthOptions(env));
        return session?.user?.id ? { userId: session.user.id } : null;
    },
    getBrowserBinding: (env) => env.OBCF_BROWSER as unknown as BrowserWorker | undefined,
    loadPuppeteer: async () => (await import('@cloudflare/puppeteer')).default,
    rateLimit: (request, env, caller) =>
        import('../../worker/lib/rate-limiting').then(({ enforceRateLimit }) =>
            enforceRateLimit(request, env, `cf-pdf:${caller.userId}`),
        ),
    getResourceOrigins: (request) => {
        const origin = new URL(request.url).origin;
        return origin.startsWith('https:') ? [origin, ...DEFAULT_PDF_RESOURCE_ORIGINS] : DEFAULT_PDF_RESOURCE_ORIGINS;
    },
    renderOptions: {
        format: 'Letter',
        viewportWidth: 816,
        viewportHeight: 1056,
        fontTimeoutMs: 3_000,
        renderTimeoutMs: 20_000,
        maxHtmlBytes: 700 * 1024,
        maxPdfBytes: 10 * 1024 * 1024,
    },
    metadata: {
        creator: 'Ottabase',
        producer: 'Ottabase PDF',
    },
});

// ── Cron → queue bridge for the demo jobs ───────────────────────────────────
// A scheduled task's payload is operator-edited JSON, so every handler validates it before
// dispatching; the queue job then carries a typed payload.
function payloadObject(payload: unknown, handler: string): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`Handler ${handler} requires a JSON object payload`);
    }
    return payload as Record<string, unknown>;
}

function requiredString(payload: Record<string, unknown>, field: string, handler: string): string {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Handler ${handler} requires payload.${field}`);
    }
    return value.trim();
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
    const value = payload[field];
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error(`payload.${field} must be a string`);
    return value;
}

function optionalObject(payload: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
    const value = payload[field];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`payload.${field} must be a JSON object`);
    }
    return value as Record<string, unknown>;
}

async function dispatchQueuedCronJob<T>(env: CloudflareEnv, type: string, payload: T): Promise<void> {
    const result = await dispatch(env.OBCF_QUEUE, type, payload);
    if (!result.success) throw result.error;
    try {
        await incrementDispatchStats(env, type);
    } catch (error) {
        // The job is already accepted; a stats write failing must not make the task retry it.
        console.warn(
            JSON.stringify({
                event: 'cron_dispatch_stats_failed',
                jobType: type,
                error: redactErrorForLog(error),
            }),
        );
    }
}

const queueBridge: Record<string, CronContribution<CloudflareEnv>> = {
    'queue:send-email': {
        description: 'Dispatch a scheduled email through the configured queue-backed mailer.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:send-email');
            const data: SendEmailPayload = {
                to: requiredString(input, 'to', 'queue:send-email'),
                subject: requiredString(input, 'subject', 'queue:send-email'),
                body: optionalString(input, 'body'),
                template: optionalString(input, 'template'),
                data: optionalObject(input, 'data'),
            };
            await dispatchQueuedCronJob(env, 'send-email', data);
        },
    },
    'queue:process-order': {
        description: 'Dispatch scheduled order processing to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:process-order');
            const orderId = input.orderId;
            if ((typeof orderId !== 'string' && typeof orderId !== 'number') || orderId === '') {
                throw new Error('Handler queue:process-order requires payload.orderId');
            }
            if (input.items !== undefined && !Array.isArray(input.items)) {
                throw new Error('payload.items must be an array');
            }
            const data: ProcessOrderPayload = {
                orderId,
                userId: optionalString(input, 'userId'),
                items: input.items as ProcessOrderPayload['items'],
            };
            await dispatchQueuedCronJob(env, 'process-order', data);
        },
    },
    'queue:generate-report': {
        description: 'Dispatch a scheduled report generation job to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:generate-report');
            const data: GenerateReportPayload = {
                reportType: requiredString(input, 'reportType', 'queue:generate-report'),
                userId: optionalString(input, 'userId'),
                params: optionalObject(input, 'params'),
            };
            await dispatchQueuedCronJob(env, 'generate-report', data);
        },
    },
    'queue:sync-data': {
        description: 'Dispatch a scheduled data synchronization job to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:sync-data');
            if (
                input.entityIds !== undefined &&
                (!Array.isArray(input.entityIds) || input.entityIds.some((id) => typeof id !== 'string'))
            ) {
                throw new Error('payload.entityIds must be an array of strings');
            }
            const data: SyncDataPayload = {
                source: requiredString(input, 'source', 'queue:sync-data'),
                target: requiredString(input, 'target', 'queue:sync-data'),
                entityType: optionalString(input, 'entityType'),
                entityIds: input.entityIds as string[] | undefined,
            };
            await dispatchQueuedCronJob(env, 'sync-data', data);
        },
    },
    'queue:batch-task': {
        description: 'Dispatch a general scheduled batch task to the queue.',
        handler: async ({ env, payload }) => {
            const input = payloadObject(payload, 'queue:batch-task');
            if (input.taskNumber !== undefined && typeof input.taskNumber !== 'number') {
                throw new Error('payload.taskNumber must be a number');
            }
            const data: BatchTaskPayload = {
                userId: optionalString(input, 'userId'),
                taskNumber: input.taskNumber as number | undefined,
                action: optionalString(input, 'action'),
                data: input.data,
            };
            await dispatchQueuedCronJob(env, 'batch-task', data);
        },
    },
};

export const appPackage = definePackage<CloudflareEnv>({
    key: 'app',
    name: 'otta-web',
    version: '1.0.0',
    description: "This app's own tables, routes and jobs.",

    tables: { todosTable }, // otta:only demo
    models: [Todo], // otta:only demo

    routes: [
        {
            basePath: CF_PDF_BASE_PATH,
            build: () => new Router<CloudflareEnv>().post('/', (c) => handleCfPdfRequest(c.req, c.env)),
        },
    ],

    cron: queueBridge,

    queue: {
        'send-email': sendEmailHandler,
        'process-order': processOrderHandler,
        'generate-report': generateReportHandler,
        'sync-data': syncDataHandler,
        'batch-task': batchTaskHandler,
    },

    env: {
        optional: [
            { key: 'OBCF_BROWSER', kind: 'binding', description: 'Browser Rendering for screenshots and PDFs.' },
        ],
    },
});
