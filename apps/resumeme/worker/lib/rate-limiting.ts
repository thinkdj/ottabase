import { createKVClient } from '@ottabase/cf/kv';
import { userKey, globalKey } from '@ottabase/cf/cache-keys';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { CloudflareEnv } from '../cloudflare-env';

/**
 * Build scoped rate limit key
 * @param key - The base key (e.g., userId, IP address, endpoint)
 * @param scope - Optional scope (user, global, or custom prefix)
 */
function buildRateLimitKey(key: string, scope?: { type: 'user' | 'global'; id?: string }): string {
    if (!scope || scope.type === 'global') {
        return globalKey('ratelimit', key);
    }

    if (scope.type === 'user' && scope.id) {
        return userKey('ratelimit', scope.id, key);
    }

    // Fallback to global scope
    return globalKey('ratelimit', key);
}

export async function simulateRateLimit(env: CloudflareEnv, key: string) {
    if (!env.OBCF_KV) {
        return null;
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const rateLimitKey = buildRateLimitKey(key);

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

export async function getRateLimitData(env: CloudflareEnv, key: string) {
    let rateLimitData: {
        success: boolean;
        limit: number;
        remaining: number;
        resetAfter: number;
    } | null = null;

    if (env.OBCF_RATE_LIMITER) {
        try {
            const limiter = createRateLimitingClient({
                rateLimiter: env.OBCF_RATE_LIMITER,
            });
            const result = await limiter.limit({ key });
            if (result.success) {
                const { success, limit, remaining, resetAfter } = result.data;
                if (limit !== undefined && remaining !== undefined && resetAfter !== undefined) {
                    rateLimitData = { success, limit, remaining, resetAfter };
                }
            }
        } catch {
            // ignore - fall back
        }
    }

    if (!rateLimitData) {
        rateLimitData = await simulateRateLimit(env, key);
    }

    return rateLimitData;
}

export async function enforceRateLimit(request: Request, env: CloudflareEnv, key: string): Promise<Response | null> {
    const rateLimitData = await getRateLimitData(env, key);
    if (!rateLimitData) {
        return errorResponse('Rate limiter not available', 500, {
            hint: 'Enable OBCF_RATE_LIMITER or OBCF_KV for rate limiting',
            code: 'CONFIG_ERROR',
        });
    }

    const { success, limit, remaining, resetAfter } = rateLimitData;
    const headers = new Headers({
        'RateLimit-Limit': String(limit),
        'RateLimit-Remaining': String(remaining),
        'RateLimit-Reset': String(resetAfter),
    });

    if (!success) {
        return new Response(
            JSON.stringify({
                error: 'Too many requests. Please try again later.',
                code: 'RATE_LIMITED',
                limit,
                remaining,
                resetAfter,
            }),
            { status: 429, headers },
        );
    }

    return null;
}
