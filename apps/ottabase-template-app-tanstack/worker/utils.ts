import type { CloudflareEnv } from "@ottabase/cf";
import { createKVClient } from "@ottabase/cf/kv";

export function isHtmlRequest(request: Request): boolean {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return false;
  }

  const accept = request.headers.get("Accept");
  return !!accept && accept.includes("text/html");
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    // @ts-expect-error - ok
    return {};
  }
}

export async function simulateRateLimit(env: CloudflareEnv, key: string) {
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

export async function checkMigrationAuth(
  request: Request,
  env: CloudflareEnv,
): Promise<boolean> {
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
