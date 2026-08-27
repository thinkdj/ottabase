import { createKVClient } from '@ottabase/cf/kv';
import { userKey, globalKey } from '@ottabase/cf/cache-keys';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
import { errorResponse } from '@ottabase/utils/http-errors';

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

    return buildRateLimitResponse(rateLimitData);
}

function buildRateLimitResponse(rateLimitData: {
    success: boolean;
    limit: number;
    remaining: number;
    resetAfter: number;
}): Response | null {
    const { success, limit, remaining, resetAfter } = rateLimitData;
    const headers = new Headers({
        'RateLimit-Limit': String(limit),
        'RateLimit-Remaining': String(remaining),
        'RateLimit-Reset': String(resetAfter),
    });

    if (!success) {
        return errorResponse('Too many requests. Please try again later.', 429, {
            code: 'RATE_LIMITED',
            metadata: { limit, remaining, resetAfter },
            headers,
        });
    }

    return null;
}

/**
 * Best-effort brute-force throttle for SECRET-GATED endpoints (bootstrap secret check,
 * platform-owner promote). The secret compare — not the limiter — is the authoritative gate
 * here; this rate limit is defense-in-depth against guessing that secret.
 *
 * Returns:
 *  - a 429 Response ONLY when the caller is actually over the limit → block;
 *  - `null` when under the limit → proceed;
 *  - `null` (after logging a warning) when the limiter itself is UNAVAILABLE (no OBCF_KV /
 *    OBCF_RATE_LIMITER binding, i.e. `enforceRateLimit` would 500). We deliberately FAIL OPEN
 *    behind the secret gate so a missing limiter binding can't brick first-run bootstrap or
 *    break-glass ownership recovery — but we log so the degraded state is diagnosable.
 *
 * Use this (not raw `enforceRateLimit`) wherever a secret already gates the endpoint, so
 * bootstrap and promote share one consistent fail-open-with-log policy instead of one silently
 * ignoring the 500 and the other 500-ing the whole request.
 */
export async function enforceBruteForceThrottle(
    request: Request,
    env: CloudflareEnv,
    key: string,
    label: string,
): Promise<Response | null> {
    const limited = await enforceRateLimit(request, env, key);
    if (!limited) return null; // under the limit → proceed
    if (limited.status === 429) return limited; // over the limit → block

    // status 500: limiter unavailable. Fail OPEN behind the secret gate, but make it visible.
    console.warn(
        `[rate-limit] limiter unavailable for "${label}" — proceeding WITHOUT brute-force throttle. ` +
            `Configure OBCF_RATE_LIMITER or OBCF_KV to restore it.`,
    );
    return null;
}
