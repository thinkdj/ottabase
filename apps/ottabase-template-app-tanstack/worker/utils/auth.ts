/**
 * Authentication and rate limiting utilities
 */

import { createKVClient } from "@ottabase/cf/kv";
import { readJson } from "./response";

/** Check migration authorization */
/** Extended env type including optional secrets */
type EnvWithSecrets = CloudflareEnv & { MIGRATION_SECRET?: string };

export async function checkMigrationAuth(request: Request, env: EnvWithSecrets): Promise<boolean> {
  const isDev = env.ENVIRONMENT === "development" || !env.ENVIRONMENT;
  if (isDev) return true;

  if (!env.MIGRATION_SECRET) return false;

  let providedSecret: string | null = null;
  const url = new URL(request.url);
  providedSecret = url.searchParams.get("secret");

  if (!providedSecret && request.method === "POST") {
    const body = await readJson<{ secret?: string }>(request);
    providedSecret = body.secret ?? null;
  }

  if (!providedSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      providedSecret = authHeader.substring(7);
    }
  }

  return providedSecret === env.MIGRATION_SECRET;
}

/** Simulated rate limiting using KV (for local dev when rate limiter binding unavailable) */
export async function simulateRateLimit(
  env: CloudflareEnv,
  key: string,
): Promise<{ success: boolean; limit: number; remaining: number; resetAfter: number } | null> {
  if (!env.OBCF_KV) return null;

  const kv = createKVClient({ namespace: env.OBCF_KV as any });
  const rateLimitKey = `ratelimit:${key}`;

  const LIMIT = 10;
  const PERIOD = 60; // seconds

  const result = await kv.getText(rateLimitKey);

  let count = 0;
  let firstRequestTime = Date.now();
  const now = Date.now();

  if (result.success && result.data) {
    try {
      const parsed = JSON.parse(result.data);
      count = parsed.count || 0;
      firstRequestTime = parsed.firstRequestTime || now;
    } catch {
      // ignore
    }
  }

  let elapsed = (now - firstRequestTime) / 1000;
  if (elapsed >= PERIOD) {
    count = 0;
    firstRequestTime = now;
    elapsed = 0;
  }

  count++;
  const isAllowed = count <= LIMIT;
  const remaining = Math.max(0, LIMIT - count);
  const resetAfter = Math.max(1, Math.ceil(PERIOD - elapsed));

  await kv.put(rateLimitKey, JSON.stringify({ count, firstRequestTime }), {
    expirationTtl: PERIOD + 10,
  });

  return {
    success: isAllowed,
    limit: LIMIT,
    remaining,
    resetAfter,
  };
}
