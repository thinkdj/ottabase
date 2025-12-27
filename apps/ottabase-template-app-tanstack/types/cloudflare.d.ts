/// <reference types="@cloudflare/workers-types" />

declare interface CloudflareEnv {
  OBCF_D1: D1Database;
  OBCF_KV: KVNamespace;
  OBCF_R2: R2Bucket;
  OBCF_QUEUE: Queue;
  OBCF_RATE_LIMITER: RateLimit;
  ENVIRONMENT: string;
  NODE_ENV: string;
}
