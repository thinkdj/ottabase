import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { createKVClient } from '@ottabase/cf/kv';
import { AuditLog } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import type { CloudflareEnv } from '../../cloudflare-env';

async function getSessionUser(request: Request, env: CloudflareEnv) {
    const session = await getSession(request, env as any, getAuthOptions(env));
    return {
        userId: session?.user?.id ?? undefined,
        userEmail: (session?.user as any)?.email ?? undefined,
        organizationId: request.headers.get('x-organization-id') || session?.user?.organizationId || undefined,
    };
}

function ensureD1ForAudit(env: CloudflareEnv) {
    if (env.OBCF_D1) {
        registerConnection('default', createD1Driver(env.OBCF_D1));
    }
}
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
    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const jobs = await getRecentProcessedJobs(context.env, limit);
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesFailed(context: AdminQueuesContext): Promise<Response> {
    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const jobs = await getFailedJobs(context.env, limit);
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesPending(context: AdminQueuesContext): Promise<Response> {
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

    jobs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return jsonResponse({ jobs });
}

export async function handleAdminQueuesResetStats(context: AdminQueuesContext): Promise<Response> {
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

    ensureD1ForAudit(env);
    const { userId, userEmail, organizationId } = await getSessionUser(context.request, env);
    AuditLog.log({
        userId,
        userEmail,
        organizationId,
        action: 'reset',
        resourceType: 'queue_stats',
        resourceId: 'queue:stats',
        metadata: { action: 'reset_stats' },
    }).catch(() => {});

    return jsonResponse({ success: true, message: 'Stats reset' });
}

export async function handleAdminQueuesDLQList(context: AdminQueuesContext): Promise<Response> {
    const limit = Math.min(parseInt(context.url.searchParams.get('limit') || '50'), 100);
    const cursor = context.url.searchParams.get('cursor') || undefined;
    const result = await getDLQJobs(context.env, limit, cursor);
    return jsonResponse(result);
}

export async function handleAdminQueuesDLQRetryAll(context: AdminQueuesContext): Promise<Response> {
    const result = await retryAllDLQJobs(context.env);

    ensureD1ForAudit(context.env);
    const { userId, userEmail, organizationId } = await getSessionUser(context.request, context.env);
    AuditLog.log({
        userId,
        userEmail,
        organizationId,
        action: 'retry',
        resourceType: 'queue_dlq',
        resourceId: 'all',
        metadata: { action: 'retry_all_dlq' },
    }).catch(() => {});

    return jsonResponse(result);
}

export async function handleAdminQueuesDLQPurge(context: AdminQueuesContext): Promise<Response> {
    const deleted = await purgeDLQ(context.env);

    ensureD1ForAudit(context.env);
    const { userId, userEmail, organizationId } = await getSessionUser(context.request, context.env);
    AuditLog.log({
        userId,
        userEmail,
        organizationId,
        action: 'purge',
        resourceType: 'queue_dlq',
        resourceId: 'all',
        metadata: { action: 'purge_dlq', deleted },
    }).catch(() => {});

    return jsonResponse({ success: true, deleted });
}

export async function handleAdminQueuesDLQJob(context: AdminQueuesContext, jobId: string): Promise<Response> {
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

        ensureD1ForAudit(env);
        const { userId, userEmail, organizationId } = await getSessionUser(request, env);
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'delete',
            resourceType: 'queue_dlq_job',
            resourceId: jobId,
        }).catch(() => {});

        return jsonResponse({ success: true });
    }

    return errorResponse('Method not allowed', 405);
}

export async function handleAdminQueuesDLQRetryJob(context: AdminQueuesContext, jobId: string): Promise<Response> {
    const result = await retryDLQJob(context.env, jobId);
    if (!result.success) {
        return errorResponse(result.error || 'Retry failed', 400, {
            code: 'RETRY_FAILED',
        });
    }

    ensureD1ForAudit(context.env);
    const { userId, userEmail, organizationId } = await getSessionUser(context.request, context.env);
    AuditLog.log({
        userId,
        userEmail,
        organizationId,
        action: 'retry',
        resourceType: 'queue_dlq_job',
        resourceId: jobId,
    }).catch(() => {});

    return jsonResponse({ success: true, message: 'Job re-queued' });
}
