import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';

export const runtime = 'edge';

// POST /api/cloudflare/rate-limiting - Test rate limit
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.RATE_LIMITER) {
      return NextResponse.json(
        {
          error: 'Rate limiter binding not configured',
          hint: 'Make sure wrangler.jsonc has the RATE_LIMITER binding enabled. Restart your dev server after making changes.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    const limiter = createRateLimitingClient({ rateLimiter: env.RATE_LIMITER });
    const result = await limiter.limit({ key });

    if (!result.success) {
      console.error('Rate limit check failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to check rate limit', details: result.error.message },
        { status: 500 }
      );
    }

    console.log('Rate limit result:', result.data);

    const { success, limit, remaining, resetAfter } = result.data;

    // Provide defaults for undefined values
    const limitValue = limit ?? 10;
    const remainingValue = remaining ?? 0;
    const resetAfterValue = resetAfter ?? 60;

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit: limitValue,
          remaining: remainingValue,
          resetAfter: resetAfterValue,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limitValue.toString(),
            'X-RateLimit-Remaining': remainingValue.toString(),
            'X-RateLimit-Reset': resetAfterValue.toString(),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Request allowed',
        limit: limitValue,
        remaining: remainingValue,
        resetAfter: resetAfterValue,
      },
      {
        headers: {
          'X-RateLimit-Limit': limitValue.toString(),
          'X-RateLimit-Remaining': remainingValue.toString(),
          'X-RateLimit-Reset': resetAfterValue.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Rate limiting error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check rate limit',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
