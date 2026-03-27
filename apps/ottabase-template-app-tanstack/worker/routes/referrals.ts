import { AnalyticsQueryError, queryEvents, validateAnalyticsConfig } from '@ottabase/analytics/query';
import { trackEvent } from '@ottabase/analytics/track';
import { getSession } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { User } from '@ottabase/ottaorm/models';
import { ReferralTracking } from '@ottabase/referrals';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';

export interface ReferralRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleReferralTrack(context: ReferralRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        referralCode?: string;
        referer?: string;
        meta?: Record<string, any>;
    }>(request);

    if (!body.referralCode) {
        return errorResponse('referralCode is required', 400);
    }

    const referrer = await User.findByReferralUsername(body.referralCode);
    if (!referrer) {
        return errorResponse('Invalid referral code', 404, {
            code: 'INVALID_REFERRAL_CODE',
        });
    }

    // Analytics Engine: write click event (non-blocking, no D1 write per click)
    const meta = body.meta as Record<string, unknown> | undefined;
    const utm = meta?.utm as Record<string, string> | undefined;
    if (env.OBCF_ANALYTICS_REFERRALS) {
        trackEvent({
            dataset: env.OBCF_ANALYTICS_REFERRALS,
            index: body.referralCode,
            blobs: [
                request.headers.get('cf-connecting-country') ?? 'unknown',
                (request.headers.get('user-agent') ?? '').slice(0, 200),
                (body.referer || request.headers.get('Referer') || '').slice(0, 500),
                referrer.get('id') ?? '',
                utm?.source ?? '',
                utm?.medium ?? '',
                utm?.campaign ?? '',
            ],
        });
    }

    return jsonResponse({
        success: true,
        tracking: { referralCode: body.referralCode, recorded: true },
    });
}

export async function handleReferralStats(context: ReferralRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const stats = await ReferralTracking.getStats(userId);
    return jsonResponse(stats);
}

export async function handleReferralUser(context: ReferralRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const user = await User.find(userId);
    if (!user) {
        return errorResponse('User not found', 404);
    }

    const stats = await ReferralTracking.getStats(userId);
    const trackingRecords = await ReferralTracking.forUser(userId, {
        limit: 100,
    });

    return jsonResponse({
        user: {
            id: user.get('id'),
            name: user.get('name'),
            email: user.get('email'),
            referralUsername: user.get('referralUsername'),
            referredById: user.get('referredById'),
        },
        stats,
        tracking: trackingRecords.map((t) => t.toJson()),
    });
}

export async function handleReferralUsernameUpdate(context: ReferralRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        referralUsername?: string;
    }>(request);

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId || !body.referralUsername) {
        return errorResponse('referralUsername is required', 400);
    }

    const { validateReferralUsername } = await import('@ottabase/referrals');
    const validation = validateReferralUsername(body.referralUsername);

    if (!validation.valid) {
        return errorResponse(validation.error || 'Invalid username', 400, {
            code: 'INVALID_USERNAME',
        });
    }

    const existing = await User.findByReferralUsername(body.referralUsername);
    if (existing && existing.get('id') !== userId) {
        return errorResponse('Username already taken', 400, {
            code: 'USERNAME_TAKEN',
        });
    }

    const user = await User.find(userId);
    if (!user) {
        return errorResponse('User not found', 404);
    }

    user.set('referralUsername', body.referralUsername);
    await user.save();

    return jsonResponse({
        success: true,
        user: user.toJson(),
    });
}

export async function handleReferralTrackingList(context: ReferralRouteContext): Promise<Response> {
    const { request, env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const { page, perPage } = parsePaginationParams(url.searchParams);
    const status = url.searchParams.get('status') as 'pending' | 'completed' | 'invalid' | null;

    const offset = (page - 1) * perPage;
    const trackingRecords = await ReferralTracking.forUser(userId, {
        status: status || undefined,
        limit: perPage,
        offset,
    });

    const allRecords = await ReferralTracking.forUser(userId, {
        status: status || undefined,
    });

    return paginatedJsonResponse({
        data: trackingRecords.map((t) => t.toJson()),
        total: allRecords.length,
        page,
        perPage,
        path: '/api/referrals/tracking',
    });
}

/**
 * Handle GET /api/referrals/analytics - query WAE for referral click analytics
 * Requires auth. Params: referralCode (optional), days (default 7), groupBy (country|referralCode|day)
 */
export async function handleReferralsAnalytics(context: ReferralRouteContext): Promise<Response> {
    const { env, request, url } = context;

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    const isDev =
        !env.ENVIRONMENT ||
        env.ENVIRONMENT === 'development' ||
        env.ENVIRONMENT === 'dev' ||
        env.ENVIRONMENT === 'test';

    if (!userId && !isDev) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const configErr = validateAnalyticsConfig({
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN,
    });
    if (configErr) {
        return errorResponse(configErr, 503, { code: 'ANALYTICS_NOT_CONFIGURED' });
    }

    const referralCode = url.searchParams.get('referralCode') ?? '';
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '7', 10)));
    const groupBy = url.searchParams.get('groupBy') ?? 'country';

    // Map referral-specific groupBy to generic groupBy shortcuts
    const groupByMap: Record<string, string> = { country: 'country', referralCode: 'index', day: 'day' };
    const resolvedGroupBy = groupByMap[groupBy];
    if (!resolvedGroupBy) {
        return errorResponse('Invalid groupBy: use country, referralCode, or day', 400, { code: 'INVALID_GROUPBY' });
    }

    try {
        const result = await queryEvents(
            { accountId: env.CLOUDFLARE_ACCOUNT_ID!, apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN! },
            {
                dataset: 'referral_clicks',
                indexFilter: referralCode || undefined,
                days,
                groupBy: resolvedGroupBy,
                limit: groupBy === 'day' ? 90 : 100,
            },
        );

        return jsonResponse({
            data: result.data,
            meta: { groupBy, days, referralCode: referralCode || null },
        });
    } catch (e) {
        if (e instanceof AnalyticsQueryError) {
            return errorResponse('Analytics query failed', 502, { code: 'ANALYTICS_ERROR', details: e.detail });
        }
        throw e;
    }
}
