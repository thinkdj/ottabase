import { AnalyticsQueryError, queryEvents, validateAnalyticsConfig } from '@ottabase/analytics/query';
import { getRequestCountry, trackEvent } from '@ottabase/analytics/track';
import { getSession } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { User } from '@ottabase/ottaorm/models';
import { generateReferralUsername, ReferralTracking, validateReferralUsername } from '@ottabase/referrals';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parseBoundedInteger, parsePaginationParams } from '@ottabase/utils/pagination';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { requireAdminAccess } from '../lib/admin-guard';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

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
                getRequestCountry(request),
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

/**
 * GET /r/{username} — shareable referral link. A 302 to the home page carrying the code in the
 * configured param (`/?ref=username`), so the client's ReferralTracker records it as usual.
 * Unknown usernames resolve null and fall through to the SPA's 404.
 */
export async function handleReferralVanityRedirect(
    context: ReferralRouteContext,
    username: string,
): Promise<Response | null> {
    const { env, url } = context;
    const { enabled, referralParam } = getOttabaseConfig(env).features.referrals;
    if (!enabled || !env.OBCF_D1 || !validateReferralUsername(username).valid) return null;

    registerConnection('default', createD1Driver(env.OBCF_D1));
    const referrer = await User.findByReferralUsername(username);
    if (!referrer) return null;

    // Keep any UTM or other params the sharer added: /r/jane?utm_source=x → /?utm_source=x&ref=jane
    const destination = new URL('/', url);
    destination.search = url.search;
    destination.searchParams.set(referralParam || 'ref', referrer.get('referralUsername'));
    return Response.redirect(destination.toString(), 302);
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

    // First visit to the dashboard: hand out a default username so the link is ready to share.
    // Assigned here rather than at signup because this one spot covers every way a user is created.
    if (!user.get('referralUsername')) {
        try {
            const referralUsername = await generateReferralUsername(
                { id: userId, name: user.get('name'), email: user.get('email') },
                async (candidate) => {
                    const holder = await User.findByReferralUsername(candidate);
                    return !!holder && holder.get('id') !== userId;
                },
            );
            user.set('referralUsername', referralUsername);
            await user.save();
        } catch (error) {
            // Non-fatal: the dashboard still lets the user pick one by hand.
            console.warn('Could not assign a default referral username:', error);
            user.set('referralUsername', null);
        }
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
 * Requires a system-scope admin. Params: referralCode (optional), days (default 7), groupBy (country|referralCode|day)
 */
export async function handleReferralsAnalytics(context: ReferralRouteContext): Promise<Response> {
    const { env, url } = context;

    // Analytics Engine rows carry no organization, so these totals are platform-wide:
    // only a system-scope admin may read them.
    const auth = await requireAdminAccess(context as unknown as ApiRouteContext, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const configErr = validateAnalyticsConfig({
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN,
    });
    if (configErr) {
        return errorResponse(configErr, 503, { code: 'ANALYTICS_NOT_CONFIGURED' });
    }

    const referralCode = url.searchParams.get('referralCode') ?? '';
    const days = parseBoundedInteger(url.searchParams.get('days'), 7, 1, 90);
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
