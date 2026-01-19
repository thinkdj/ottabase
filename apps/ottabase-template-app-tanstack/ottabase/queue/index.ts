/**
 * Queue Configuration
 *
 * This file sets up the queue handler registry for this app.
 * Add your job handlers here to process queue messages.
 */

import { createRegistry, createQueueHandler } from "@ottabase/queue";
import type { CloudflareEnv } from "../../cloudflare-env";
import {
  sendEmailHandler,
  processOrderHandler,
  generateReportHandler,
  syncDataHandler,
  batchTaskHandler,
} from "./handlers";

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
 * Queue handler for Cloudflare Workers
 * Export this in your worker's default export
 */
export const queueHandler = createQueueHandler(createAppQueueRegistry(), {
  onBeforeProcess: async (job) => {
    console.log(`[Queue] Starting job: ${job.type} (id: ${job.meta?.id})`);
  },
  onAfterProcess: async (job) => {
    console.log(`[Queue] Completed job: ${job.type} (id: ${job.meta?.id})`);
  },
  onFailure: async (job, error) => {
    console.error(`[Queue] Job failed permanently: ${job.type}`, error.message);
    // TODO: Could store failed jobs in D1/KV for manual review
  },
});

// Re-export handlers for direct use if needed
export * from "./handlers";
