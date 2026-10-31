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

export async function simulateRateLimit(env: CloudflareEnv, key: string, limit = 10) {
    if (!env.OBCF_KV) {
        return null;
    }

    const kv = createKVClient({ namespace: env.OBCF_KV as any });
    const rateLimitKey = buildRateLimitKey(key);

    const LIMIT = limit;
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

export async function getRateLimitData(
    env: CloudflareEnv,
    key: string,
    // The binding to count with and, without it, the per-minute limit the KV fallback applies.
    limiter: RateLimit | undefined = env.OBCF_RATE_LIMITER,
    fallbackLimit = 10,
) {
    let rateLimitData: {
        success: boolean;
        limit: number;
        remaining: number;
        resetAfter: number;
    } | null = null;

    if (limiter) {
        try {
            const client = createRateLimitingClient({
                rateLimiter: limiter,
            });
            const result = await client.limit({ key });
            // A Workers rate-limit binding answers only `{ success }`: its verdict decides. The
            // numbers it leaves out only shape the 429's informational headers.
            if (result.success && typeof result.data.success === 'boolean') {
                const { success, limit, remaining, resetAfter } = result.data;
                rateLimitData = {
                    success,
                    limit: limit ?? fallbackLimit,
                    remaining: remaining ?? (success ? 1 : 0),
                    resetAfter: resetAfter ?? 60,
                };
            }
        } catch {
            // ignore - fall back
        }
    }

    if (!rateLimitData) {
        rateLimitData = await simulateRateLimit(env, key, fallbackLimit);
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

/** Uploads per user per minute, matching the OBCF_RATE_LIMITER_UPLOADS binding in wrangler.jsonc. */
export const UPLOAD_RATE_LIMIT_PER_MINUTE = 60;

/**
 * The limiter for file uploads (POST /api/files, the avatar route): its own binding,
 * OBCF_RATE_LIMITER_UPLOADS, at 60 per minute per user, so a bulk media-library upload is not
 * cut off at the shared limiter's 10. Fails closed: a production deploy without the binding
 * refuses uploads (500 CONFIG_ERROR) rather than letting them through uncounted; elsewhere the
 * KV counter stands in at the same rate, and without KV either this 500s like enforceRateLimit.
 */
export async function enforceUploadRateLimit(
    request: Request,
    env: CloudflareEnv,
    userId: string,
): Promise<Response | null> {
    const limiter = env.OBCF_RATE_LIMITER_UPLOADS;
    if (!limiter && env.ENVIRONMENT === 'production') {
        return errorResponse('Upload rate limiter not configured', 500, {
            hint: 'Bind OBCF_RATE_LIMITER_UPLOADS in wrangler.jsonc',
            code: 'CONFIG_ERROR',
        });
    }
    const key = `files:upload:${userId}`;
    const rateLimitData = await getRateLimitData(env, key, limiter, UPLOAD_RATE_LIMIT_PER_MINUTE);
    if (!rateLimitData) {
        return errorResponse('Rate limiter not available', 500, {
            hint: 'Enable OBCF_RATE_LIMITER_UPLOADS or OBCF_KV for rate limiting',
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
