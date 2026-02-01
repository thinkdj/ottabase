/**
 * Rate limiting utilities using Cloudflare KV
 */

import { createKVClient } from '@ottabase/cf/kv';

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
