/**
 * Queue Configuration
 *
 * This file sets up the queue handler registry for this app.
 * Add your job handlers here to process queue messages.
 */

import { createKVClient } from '@ottabase/cf/kv';
import { createQueueHandler, createRegistry, dispatch, type QueuedJob } from '@ottabase/queue';
import type { CloudflareEnv } from '../../cloudflare-env';
import {
    batchTaskHandler,
    generateReportHandler,
    processOrderHandler,
    sendEmailHandler,
    syncDataHandler,
} from './handlers';

// KV keys for queue stats
const STATS_KEY = 'queue:stats';
const PROCESSED_PREFIX = 'queue:processed:';
const FAILED_PREFIX = 'queue:failed:';
const DLQ_PREFIX = 'queue:dlq:';

// TTL constants (in seconds)
const HISTORY_TTL = 86400; // 24 hours for processed/failed history
const DLQ_TTL = 604800; // 7 days for dead letter queue

/**
 * Queue statistics stored in KV
 */
export interface QueueStats {
    totalDispatched: number;
    totalProcessed: number;
    totalFailed: number;
    totalDLQ: number;
    byJobType: Record<string, { dispatched: number; processed: number; failed: number }>;
    lastUpdated: number;
}

/**
 * Processed job record for history
 */
export interface ProcessedJob {
    id: string;
    type: string;
    status: 'completed' | 'failed';
    processedAt: number;
    duration?: number;
    error?: string;
    attempts: number;
}

/**
 * Dead Letter Queue job record - includes full payload for retry
 */
export interface DLQJob {
    id: string;
    type: string;
    payload: unknown;
    error: string;
    failedAt: number;
    attempts: number;
    originalMeta?: Record<string, unknown>;
}

/**
 * Paginated result for DLQ listing
 */
export interface PaginatedDLQResult {
    jobs: DLQJob[];
    cursor?: string;
    hasMore: boolean;
    total?: number;
}

/**
 * Get current queue stats from KV
 */
export async function getQueueStats(env: CloudflareEnv): Promise<QueueStats> {
    const defaultStats: QueueStats = {
        totalDispatched: 0,
        totalProcessed: 0,
        totalFailed: 0,
        totalDLQ: 0,
        byJobType: {},
        lastUpdated: Date.now(),
    };

    if (!env.OBCF_KV) {
        return defaultStats;
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const result = await kv.getText(STATS_KEY);

    if (result.success && result.data) {
        try {
            const stats = JSON.parse(result.data);
            // Ensure totalDLQ exists for backwards compatibility
            return { ...defaultStats, ...stats };
        } catch {
            // ignore parse errors
        }
    }

    return defaultStats;
}

/**
 * Update queue stats in KV
 */
async function updateStats(env: CloudflareEnv, update: (stats: QueueStats) => void): Promise<void> {
    if (!env.OBCF_KV) return;

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const stats = await getQueueStats(env);
    update(stats);
    stats.lastUpdated = Date.now();
    await kv.put(STATS_KEY, JSON.stringify(stats));
}

/**
 * Increment dispatch stats when jobs are dispatched
 * Call this from dispatch endpoints to track totalDispatched accurately
 */
export async function incrementDispatchStats(env: CloudflareEnv, jobType: string, count = 1): Promise<void> {
    await updateStats(env, (stats) => {
        stats.totalDispatched += count;
        if (!stats.byJobType[jobType]) {
            stats.byJobType[jobType] = { dispatched: 0, processed: 0, failed: 0 };
        }
        stats.byJobType[jobType].dispatched += count;
    });
}

/**
 * Store processed job record
 */
async function storeProcessedJob(env: CloudflareEnv, job: ProcessedJob): Promise<void> {
    if (!env.OBCF_KV) return;

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const prefix = job.status === 'failed' ? FAILED_PREFIX : PROCESSED_PREFIX;
    const key = `${prefix}${Date.now()}:${job.id}`;
    await kv.put(key, JSON.stringify(job), { expirationTtl: HISTORY_TTL });
}

/**
 * Store job in Dead Letter Queue (after max retries exhausted)
 */
async function storeDLQJob(env: CloudflareEnv, job: QueuedJob, error: Error): Promise<void> {
    if (!env.OBCF_KV) return;

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const jobId = job.meta?.id || `dlq-${Date.now()}`;
    const key = `${DLQ_PREFIX}${Date.now()}:${jobId}`;

    const dlqJob: DLQJob = {
        id: jobId,
        type: job.type,
        payload: job.payload,
        error: error.message,
        failedAt: Date.now(),
        attempts: job.meta?.attempts || 1,
        originalMeta: job.meta,
    };

    await kv.put(key, JSON.stringify(dlqJob), { expirationTtl: DLQ_TTL });

    // Update DLQ count in stats
    await updateStats(env, (stats) => {
        stats.totalDLQ++;
    });
}

/**
 * Get recent processed jobs
 */
export async function getRecentProcessedJobs(env: CloudflareEnv, limit = 50): Promise<ProcessedJob[]> {
    if (!env.OBCF_KV) return [];

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const jobs: ProcessedJob[] = [];

    // Get both processed and failed
    for (const prefix of [PROCESSED_PREFIX, FAILED_PREFIX]) {
        const listResult = await kv.list({ prefix, limit: limit / 2 });
        if (listResult.success) {
            for (const key of listResult.data.keys) {
                const result = await kv.getText(key.name);
                if (result.success && result.data) {
                    try {
                        jobs.push(JSON.parse(result.data));
                    } catch {
                        // ignore
                    }
                }
            }
        }
    }

    // Sort by processedAt desc
    return jobs.sort((a, b) => b.processedAt - a.processedAt).slice(0, limit);
}

/**
 * Get recent failed jobs
 */
export async function getFailedJobs(env: CloudflareEnv, limit = 50): Promise<ProcessedJob[]> {
    if (!env.OBCF_KV) return [];

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const listResult = await kv.list({ prefix: FAILED_PREFIX, limit });

    if (!listResult.success) return [];

    const jobs: ProcessedJob[] = [];
    for (const key of listResult.data.keys) {
        const result = await kv.getText(key.name);
        if (result.success && result.data) {
            try {
                jobs.push(JSON.parse(result.data));
            } catch {
                // ignore
            }
        }
    }

    return jobs.sort((a, b) => b.processedAt - a.processedAt);
}

// ============================================================================
// Dead Letter Queue (DLQ) Functions
// ============================================================================

/**
 * Get DLQ jobs with pagination support
 * @param env - Cloudflare environment
 * @param limit - Number of jobs to fetch (max 1000)
 * @param cursor - Pagination cursor from previous request
 */
export async function getDLQJobs(env: CloudflareEnv, limit = 50, cursor?: string): Promise<PaginatedDLQResult> {
    if (!env.OBCF_KV) {
        return { jobs: [], hasMore: false };
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const listResult = await kv.list({
        prefix: DLQ_PREFIX,
        limit: Math.min(limit, 1000),
        cursor,
    });

    if (!listResult.success) {
        return { jobs: [], hasMore: false };
    }

    const jobs: DLQJob[] = [];
    for (const key of listResult.data.keys) {
        const result = await kv.getText(key.name);
        if (result.success && result.data) {
            try {
                const job = JSON.parse(result.data) as DLQJob;
                // Store the KV key for deletion/retry operations
                (job as any)._kvKey = key.name;
                jobs.push(job);
            } catch {
                // ignore parse errors
            }
        }
    }

    // Sort by failedAt desc (most recent first)
    jobs.sort((a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime());

    return {
        jobs,
        cursor: listResult.data.cursor || undefined,
        hasMore: !listResult.data.list_complete,
    };
}

/**
 * Get a single DLQ job by ID
 */
export async function getDLQJob(env: CloudflareEnv, jobId: string): Promise<DLQJob | null> {
    if (!env.OBCF_KV) return null;

    const kv = createKVClient({ namespace: env.OBCF_KV as any });

    // List keys with DLQ prefix to find the job
    const listResult = await kv.list({ prefix: DLQ_PREFIX, limit: 1000 });
    if (!listResult.success) return null;

    for (const key of listResult.data.keys) {
        if (key.name.includes(jobId)) {
            const result = await kv.getText(key.name);
            if (result.success && result.data) {
                try {
                    const job = JSON.parse(result.data) as DLQJob;
                    (job as any)._kvKey = key.name;
                    return job;
                } catch {
                    // ignore
                }
            }
        }
    }

    return null;
}

/**
 * Delete a job from the DLQ
 */
export async function deleteDLQJob(env: CloudflareEnv, jobId: string): Promise<boolean> {
    if (!env.OBCF_KV) return false;

    const kv = createKVClient({ namespace: env.OBCF_KV as any });

    // Find and delete the job
    const listResult = await kv.list({ prefix: DLQ_PREFIX, limit: 1000 });
    if (!listResult.success) return false;

    for (const key of listResult.data.keys) {
        if (key.name.includes(jobId)) {
            await kv.delete(key.name);
            // Decrement DLQ count
            await updateStats(env, (stats) => {
                stats.totalDLQ = Math.max(0, stats.totalDLQ - 1);
            });
            return true;
        }
    }

    return false;
}

/**
 * Retry a job from the DLQ - re-dispatches to queue and removes from DLQ
 */
export async function retryDLQJob(env: CloudflareEnv, jobId: string): Promise<{ success: boolean; error?: string }> {
    if (!env.OBCF_KV || !env.OBCF_QUEUE) {
        return { success: false, error: 'KV or Queue not configured' };
    }

    // Find the job in DLQ
    const job = await getDLQJob(env, jobId);
    if (!job) {
        return { success: false, error: 'Job not found in DLQ' };
    }

    try {
        // Re-dispatch the job to the queue
        const result = await dispatch(env.OBCF_QUEUE, job.type, job.payload);
        if (!result.success) {
            return { success: false, error: result.error.message };
        }

        // Remove from DLQ
        await deleteDLQJob(env, jobId);

        // Increment dispatch stats
        await incrementDispatchStats(env, job.type);

        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

/**
 * Retry all jobs in the DLQ
 */
export async function retryAllDLQJobs(
    env: CloudflareEnv,
): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    if (!env.OBCF_KV || !env.OBCF_QUEUE) {
        result.errors.push('KV or Queue not configured');
        return result;
    }

    // Get all DLQ jobs (paginate through all)
    let cursor: string | undefined;
    do {
        const page = await getDLQJobs(env, 100, cursor);
        for (const job of page.jobs) {
            const retryResult = await retryDLQJob(env, job.id);
            if (retryResult.success) {
                result.success++;
            } else {
                result.failed++;
                result.errors.push(`${job.id}: ${retryResult.error}`);
            }
        }
        cursor = page.cursor;
    } while (cursor);

    return result;
}

/**
 * Purge all jobs from the DLQ
 */
export async function purgeDLQ(env: CloudflareEnv): Promise<number> {
    if (!env.OBCF_KV) return 0;

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    let deleted = 0;
    let cursor: string | undefined;

    do {
        const listResult = await kv.list({ prefix: DLQ_PREFIX, limit: 1000, cursor });
        if (!listResult.success) break;

        for (const key of listResult.data.keys) {
            await kv.delete(key.name);
            deleted++;
        }

        cursor = listResult.data.cursor || undefined;
    } while (cursor);

    // Reset DLQ count in stats
    await updateStats(env, (stats) => {
        stats.totalDLQ = 0;
    });

    return deleted;
}

/**
 * Create the queue handler registry
 * Register all your job handlers here
 */
export function createAppQueueRegistry() {
    return createRegistry<CloudflareEnv>()
        .register('send-email', sendEmailHandler)
        .register('process-order', processOrderHandler)
        .register('generate-report', generateReportHandler)
        .register('sync-data', syncDataHandler)
        .register('batch-task', batchTaskHandler)
        .setDefault(async (job, ctx) => {
            // Default handler for unknown job types
            console.warn(`[Queue] Unknown job type: ${job.type}`);
            console.log(`  Payload: ${JSON.stringify(job.payload)}`);
            console.log(`  Attempt: ${ctx.attempt}`);
            // Ack to prevent infinite retries
            ctx.ack();
        });
}

/**
 * Create queue handler with stats tracking
 */
export function createAppQueueHandler() {
    // Track job start times for duration calculation
    // Scoped to this handler instance to avoid module-level memory leaks
    const jobStartTimes = new Map<string, number>();

    return createQueueHandler(createAppQueueRegistry(), {
        onBeforeProcess: async (job: QueuedJob) => {
            const jobId = job.meta?.id || 'unknown';
            jobStartTimes.set(jobId, Date.now());
            console.log(`[Queue] Starting job: ${job.type} (id: ${jobId})`);
        },
        onAfterProcess: async (job: QueuedJob, env?: CloudflareEnv) => {
            const jobId = job.meta?.id || 'unknown';
            const startTime = jobStartTimes.get(jobId);
            const duration = startTime ? Date.now() - startTime : undefined;
            jobStartTimes.delete(jobId);

            console.log(`[Queue] Completed job: ${job.type} (id: ${jobId})`);

            if (env) {
                // Update stats
                await updateStats(env, (stats) => {
                    stats.totalProcessed++;
                    if (!stats.byJobType[job.type]) {
                        stats.byJobType[job.type] = { dispatched: 0, processed: 0, failed: 0 };
                    }
                    stats.byJobType[job.type].processed++;
                });

                // Store processed job record
                await storeProcessedJob(env, {
                    id: jobId,
                    type: job.type,
                    status: 'completed',
                    processedAt: Date.now(),
                    duration,
                    attempts: job.meta?.attempts || 1,
                });
            }
        },
        onFailure: async (job: QueuedJob, error: Error, env?: CloudflareEnv) => {
            const jobId = job.meta?.id || 'unknown';
            const startTime = jobStartTimes.get(jobId);
            const duration = startTime ? Date.now() - startTime : undefined;
            jobStartTimes.delete(jobId);

            console.error(`[Queue] Job failed permanently: ${job.type}`, error.message);

            if (env) {
                // Update stats
                await updateStats(env, (stats) => {
                    stats.totalFailed++;
                    if (!stats.byJobType[job.type]) {
                        stats.byJobType[job.type] = { dispatched: 0, processed: 0, failed: 0 };
                    }
                    stats.byJobType[job.type].failed++;
                });

                // Store failed job record
                await storeProcessedJob(env, {
                    id: jobId,
                    type: job.type,
                    status: 'failed',
                    processedAt: Date.now(),
                    duration,
                    error: error.message,
                    attempts: job.meta?.attempts || 1,
                });

                // Store in Dead Letter Queue for retry capability
                await storeDLQJob(env, job, error);
            }
        },
    });
}

/**
 * Queue handler for Cloudflare Workers
 * Export this in your worker's default export
 */
export const queueHandler = createAppQueueHandler();

// Re-export handlers for direct use if needed
export * from './handlers';
