/**
 * Queue Configuration
 *
 * This file sets up the queue handler registry for this app.
 * Add your job handlers here to process queue messages.
 */

import { createRegistry, createQueueHandler, type QueuedJob } from "@ottabase/queue";
import { createKVClient } from "@ottabase/cf/kv";
import type { CloudflareEnv } from "../../cloudflare-env";
import {
  sendEmailHandler,
  processOrderHandler,
  generateReportHandler,
  syncDataHandler,
  batchTaskHandler,
} from "./handlers";

// KV keys for queue stats
const STATS_KEY = "queue:stats";
const PROCESSED_PREFIX = "queue:processed:";
const FAILED_PREFIX = "queue:failed:";

/**
 * Queue statistics stored in KV
 */
export interface QueueStats {
  totalDispatched: number;
  totalProcessed: number;
  totalFailed: number;
  byJobType: Record<string, { dispatched: number; processed: number; failed: number }>;
  lastUpdated: string;
}

/**
 * Processed job record for history
 */
export interface ProcessedJob {
  id: string;
  type: string;
  status: "completed" | "failed";
  processedAt: string;
  duration?: number;
  error?: string;
  attempts: number;
}

/**
 * Get current queue stats from KV
 */
export async function getQueueStats(env: CloudflareEnv): Promise<QueueStats> {
  if (!env.OBCF_KV) {
    return {
      totalDispatched: 0,
      totalProcessed: 0,
      totalFailed: 0,
      byJobType: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  const kv = createKVClient({ namespace: env.OBCF_KV as any });
  const result = await kv.getText(STATS_KEY);

  if (result.success && result.data) {
    try {
      return JSON.parse(result.data);
    } catch {
      // ignore parse errors
    }
  }

  return {
    totalDispatched: 0,
    totalProcessed: 0,
    totalFailed: 0,
    byJobType: {},
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Update queue stats in KV
 */
async function updateStats(
  env: CloudflareEnv,
  update: (stats: QueueStats) => void
): Promise<void> {
  if (!env.OBCF_KV) return;

  const kv = createKVClient({ namespace: env.OBCF_KV as any });
  const stats = await getQueueStats(env);
  update(stats);
  stats.lastUpdated = new Date().toISOString();
  await kv.put(STATS_KEY, JSON.stringify(stats));
}

/**
 * Store processed job record
 */
async function storeProcessedJob(
  env: CloudflareEnv,
  job: ProcessedJob
): Promise<void> {
  if (!env.OBCF_KV) return;

  const kv = createKVClient({ namespace: env.OBCF_KV as any });
  const prefix = job.status === "failed" ? FAILED_PREFIX : PROCESSED_PREFIX;
  const key = `${prefix}${Date.now()}:${job.id}`;
  await kv.put(key, JSON.stringify(job), { expirationTtl: 86400 }); // 24 hour TTL
}

/**
 * Get recent processed jobs
 */
export async function getRecentProcessedJobs(
  env: CloudflareEnv,
  limit = 50
): Promise<ProcessedJob[]> {
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
  return jobs
    .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
    .slice(0, limit);
}

/**
 * Get recent failed jobs
 */
export async function getFailedJobs(
  env: CloudflareEnv,
  limit = 50
): Promise<ProcessedJob[]> {
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

  return jobs.sort(
    (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
  );
}

/**
 * Create the queue handler registry
 * Register all your job handlers here
 */
export function createAppQueueRegistry() {
  return createRegistry<CloudflareEnv>()
    .register("send-email", sendEmailHandler)
    .register("process-order", processOrderHandler)
    .register("generate-report", generateReportHandler)
    .register("sync-data", syncDataHandler)
    .register("batch-task", batchTaskHandler)
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
      const jobId = job.meta?.id || "unknown";
      jobStartTimes.set(jobId, Date.now());
      console.log(`[Queue] Starting job: ${job.type} (id: ${jobId})`);
    },
    onAfterProcess: async (job: QueuedJob, env?: CloudflareEnv) => {
      const jobId = job.meta?.id || "unknown";
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
          status: "completed",
          processedAt: new Date().toISOString(),
          duration,
          attempts: job.meta?.attempts || 1,
        });
      }
    },
    onFailure: async (job: QueuedJob, error: Error, env?: CloudflareEnv) => {
      const jobId = job.meta?.id || "unknown";
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
          status: "failed",
          processedAt: new Date().toISOString(),
          duration,
          error: error.message,
          attempts: job.meta?.attempts || 1,
        });
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
export * from "./handlers";
