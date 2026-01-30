import type { KVNamespace } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createKVClient } from '@ottabase/cf/kv';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Simulated rate limiter using KV for local dev
async function simulateRateLimit(env: { OBCF_KV?: KVNamespace }, key: string) {
    if (!env.OBCF_KV) {
        console.log('[Rate Limit] KV not available');
        return null; // KV not available, can't simulate
    }

    const kv = createKVClient({ namespace: env.OBCF_KV });
    const rateLimitKey = `ratelimit:${key}`;

    const LIMIT = 10;
    const PERIOD = 60; // seconds

    // Get current count and timestamp
    console.log(`[Rate Limit] Getting data for key: ${rateLimitKey}`);
    const result = await kv.getText(rateLimitKey);
    console.log(`[Rate Limit] KV get result:`, {
        success: result.success,
        hasData: result.success ? !!result.data : false,
        dataType: result.success ? typeof result.data : 'error',
        data: result.success ? result.data : null,
    });

    let count = 0;
    let firstRequestTime = Date.now();
    const now = Date.now();

    if (result.success && result.data) {
        try {
            console.log(`[Rate Limit] Parsing stored data: ${result.data}`);
            const data = JSON.parse(result.data);
            console.log(`[Rate Limit] Parsed data:`, data);
            count = data.count || 0;
            firstRequestTime = data.firstRequestTime || now;
            console.log(
                `[Rate Limit] Loaded count=${count}, firstRequestTime=${new Date(firstRequestTime).toISOString()}`,
            );
        } catch (error) {
            console.error('[Rate Limit] Error parsing stored data:', error);
            // Invalid data, reset
        }
    } else {
        console.log(`[Rate Limit] No stored data found, starting fresh with count=0`);
    }

    // Check if period has expired
    let elapsed = (now - firstRequestTime) / 1000;
    console.log(`[Rate Limit] Time elapsed: ${elapsed}s (period: ${PERIOD}s)`);
    if (elapsed >= PERIOD) {
        console.log(`[Rate Limit] Period expired, resetting counter`);
        // Reset the counter for new period
        count = 0;
        firstRequestTime = now;
        elapsed = 0; // Recalculate elapsed after reset
    }

    // Increment counter for this request
    const oldCount = count;
    count++;
    console.log(`[Rate Limit] Incrementing count: ${oldCount} -> ${count}`);

    // Check if limit exceeded
    const isAllowed = count <= LIMIT;
    const remaining = Math.max(0, LIMIT - count);
    const resetAfter = Math.max(1, Math.ceil(PERIOD - elapsed));

    console.log(
        `[Rate Limit] Decision: count=${count}, limit=${LIMIT}, isAllowed=${isAllowed} (${count} <= ${LIMIT} = ${
            count <= LIMIT
        })`,
    );

    // Store updated count
    const dataToStore = JSON.stringify({ count, firstRequestTime });
    console.log(`[Rate Limit] Storing data: ${dataToStore}`);
    const putResult = await kv.put(
        rateLimitKey,
        dataToStore,
        { expirationTtl: PERIOD + 10 }, // Add buffer to prevent early expiration
    );
    console.log(`[Rate Limit] KV put result:`, putResult);

    console.log(
        `[Rate Limit] Final result for ${key}: count=${count}, limit=${LIMIT}, remaining=${remaining}, resetAfter=${resetAfter}, allowed=${isAllowed}`,
    );

    return {
        success: isAllowed,
        limit: LIMIT,
        remaining,
        resetAfter,
    };
}

// POST /api/cloudflare/rate-limiting - Test rate limit
export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        const body = await request.json();
        const { key } = body;

        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 });
        }

        let rateLimitData: {
            success: boolean;
            limit: number;
            remaining: number;
            resetAfter: number;
        } | null = null;

        // Try real rate limiter first
        if (env.OBCF_RATE_LIMITER) {
            try {
                const limiter = createRateLimitingClient({
                    rateLimiter: env.OBCF_RATE_LIMITER,
                });
                const result = await limiter.limit({ key });

                if (result.success) {
                    const { success, limit, remaining, resetAfter } = result.data;

                    // Check if we got valid data (not all undefined)
                    if (limit !== undefined && remaining !== undefined && resetAfter !== undefined) {
                        rateLimitData = { success, limit, remaining, resetAfter };
                    }
                }
            } catch (error) {
                console.warn('Real rate limiter failed, falling back to simulation:', error);
            }
        }

        // Fallback to simulated rate limiter for local dev
        if (!rateLimitData) {
            console.log('Using simulated rate limiter with KV storage');
            rateLimitData = await simulateRateLimit(env, key);

            if (!rateLimitData) {
                return NextResponse.json(
                    {
                        error: 'Rate limiter not available',
                        hint: 'Enable OBCF_RATE_LIMITER binding or ensure OBCF_KV is configured for local dev simulation',
                    },
                    { status: 500 },
                );
            }
        }

        const { success, limit, remaining, resetAfter } = rateLimitData;

        if (!success) {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    limit,
                    remaining,
                    resetAfter,
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': limit.toString(),
                        'X-RateLimit-Remaining': remaining.toString(),
                        'X-RateLimit-Reset': resetAfter.toString(),
                    },
                },
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Request allowed',
                limit,
                remaining,
                resetAfter,
            },
            {
                headers: {
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': resetAfter.toString(),
                },
            },
        );
    } catch (error) {
        console.error('Rate limiting error:', error);
        return NextResponse.json(
            {
                error: 'Failed to check rate limit',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
