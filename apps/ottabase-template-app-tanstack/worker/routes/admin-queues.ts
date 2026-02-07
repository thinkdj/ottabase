import { createKVClient } from '@ottabase/cf/kv';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminRoute } from '../lib/admin-utils';
import type { CloudflareEnv } from '../../cloudflare-env';
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

export interface AdminQueuesContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleAdminQueuesOverview(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

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
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const jobs = await getRecentProcessedJobs(context.env, limit);
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesFailed(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const jobs = await getFailedJobs(context.env, limit);
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesPending(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

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
        const kvResult = await kv.get(key.name);
        if (kvResult.success && kvResult.data) {
            try {
                const message = JSON.parse(kvResult.data as string);
                jobs.push({ key: key.name, ...message });
            } catch {
                // ignore
            }
        }
    }

    jobs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesResetStats(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

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
            lastUpdated: new Date().toISOString(),
        }),
    );

    return jsonResponse({ success: true, message: 'Stats reset' });
}

export async function handleAdminQueuesDLQList(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const cursor = context.url.searchParams.get('cursor') || undefined;
    const dlqResult = await getDLQJobs(context.env, limit, cursor);
    return jsonResponse(dlqResult);
}

export async function handleAdminQueuesDLQRetryAll(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const retryResult = await retryAllDLQJobs(context.env);
    return jsonResponse(retryResult);
}

export async function handleAdminQueuesDLQPurge(context: AdminQueuesContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const deleted = await purgeDLQ(context.env);
    return jsonResponse({ success: true, deleted });
}

export async function handleAdminQueuesDLQJob(context: AdminQueuesContext, jobId: string): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

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
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const retryResult = await retryDLQJob(context.env, jobId);
    if (!retryResult.success) {
        return errorResponse(retryResult.error || 'Retry failed', 400, {
            code: 'RETRY_FAILED',
        });
    }
    return jsonResponse({ success: true, message: 'Job re-queued' });
}
