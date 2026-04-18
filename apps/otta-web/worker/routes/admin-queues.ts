import { createKVClient } from '@ottabase/cf/kv';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import {
    deleteDLQJob,
    getDLQJob,
    getDLQJobs,
    getFailedJobs,
    getQueueStats,
    getRecentProcessedJobs,
    purgeDLQ,
    retryAllDLQJobs,
    retryDLQJob,
} from '../../ottabase/queue';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

export type AdminQueuesContext = ApiRouteContext;

export async function handleAdminQueuesOverview(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env } = context;

    const stats = await getQueueStats(env);
    let pendingCount = 0;
    if (env.OBCF_KV) {
        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const listResult = await kv.list({ prefix: 'queue:message:' });
        if (listResult.success) {
            pendingCount = listResult.data.keys.length;
        }
    }

    const registeredHandlers = [
        { type: 'send-email', description: 'Send email notifications' },
        { type: 'process-order', description: 'Process order transactions' },
        { type: 'generate-report', description: 'Generate reports asynchronously' },
        { type: 'sync-data', description: 'Synchronize data between systems' },
        { type: 'batch-task', description: 'Generic batch processing task' },
    ];

    return jsonResponse({
        stats,
        pendingCount,
        registeredHandlers,
        queueBinding: env.OBCF_QUEUE ? 'configured' : 'not configured',
    });
}

export async function handleAdminQueuesProcessed(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const jobs = await getRecentProcessedJobs(context.env, limit);
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesFailed(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const jobs = await getFailedJobs(context.env, limit);
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesPending(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, url } = context;
    if (!env.OBCF_KV) {
        return errorResponse('KV binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const listResult = await kv.list({
        prefix: 'queue:message:',
        limit,
    });

    if (!listResult.success) {
        return errorResponse('Failed to list pending jobs', 500);
    }

    const jobs: any[] = [];
    for (const key of listResult.data.keys) {
        const result = await kv.get(key.name);
        if (result.success && result.data) {
            try {
                const message = JSON.parse(result.data as string);
                jobs.push({ key: key.name, ...message });
            } catch {
                // ignore
            }
        }
    }

    jobs.sort((a, b) => Number(b.sentAt) - Number(a.sentAt));
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesResetStats(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env } = context;
    if (!env.OBCF_KV) {
        return errorResponse('KV binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    await kv.put(
        'queue:stats',
        JSON.stringify({
            totalDispatched: 0,
            totalProcessed: 0,
            totalFailed: 0,
            totalDLQ: 0,
            byJobType: {},
            lastUpdated: Date.now(),
        }),
    );

    return jsonResponse({ success: true, message: 'Stats reset' });
}

export async function handleAdminQueuesDLQList(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const cursor = context.url.searchParams.get('cursor') || undefined;
    const result = await getDLQJobs(context.env, limit, cursor);
    return jsonResponse(result);
}

export async function handleAdminQueuesDLQRetryAll(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const result = await retryAllDLQJobs(context.env);
    return jsonResponse(result);
}

export async function handleAdminQueuesDLQPurge(context: AdminQueuesContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const deleted = await purgeDLQ(context.env);
    return jsonResponse({ success: true, deleted });
}

export async function handleAdminQueuesDLQJob(context: AdminQueuesContext, jobId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env } = context;
    if (request.method === 'GET') {
        const job = await getDLQJob(env, jobId);
        if (!job) {
            return errorResponse('Job not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse({ job });
    }

    if (request.method === 'DELETE') {
        const deleted = await deleteDLQJob(env, jobId);
        if (!deleted) {
            return errorResponse('Job not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse({ success: true });
    }

    return errorResponse('Method not allowed', 405);
}

export async function handleAdminQueuesDLQRetryJob(context: AdminQueuesContext, jobId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const result = await retryDLQJob(context.env, jobId);
    if (!result.success) {
        return errorResponse(result.error || 'Retry failed', 400, {
            code: 'RETRY_FAILED',
        });
    }
    return jsonResponse({ success: true, message: 'Job re-queued' });
}
