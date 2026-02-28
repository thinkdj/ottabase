import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import { getRateLimitData } from '../lib/rate-limiting';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface RateLimitingContext {
    request: Request;
    env: CloudflareEnv;
}

export async function handleRateLimiting(context: RateLimitingContext): Promise<Response> {
    const { request, env } = context;
    const body = await readJson<{ key?: string }>(request);
    if (!body.key) return errorResponse('Key is required', 400);

    const rateLimitData = await getRateLimitData(env, body.key);
    if (!rateLimitData) {
        return errorResponse('Rate limiter not available', 500, {
            hint: 'Enable OBCF_RATE_LIMITER binding or ensure OBCF_KV is configured for local dev simulation',
            code: 'CONFIG_ERROR',
        });
    }

    const { success, limit, remaining, resetAfter } = rateLimitData;
    const headers = {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetAfter.toString(),
    };

    if (!success) {
        const response = errorResponse('Rate limit exceeded', 429, {
            code: 'RATE_LIMITED',
            details: `Limit: ${limit}, Remaining: ${remaining}, Reset After: ${resetAfter}`,
        });
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        return response;
    }

    const response = jsonResponse(
        {
            success: true,
            message: 'Request allowed',
            limit,
            remaining,
            resetAfter,
        },
        200,
    );
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
}
