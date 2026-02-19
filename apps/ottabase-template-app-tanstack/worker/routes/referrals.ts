import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { readJson, getClientIpAddress } from '../lib/utils';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { ReferralTracking } from '@ottabase/referrals';
import { User } from '@ottabase/ottaorm/models';
import type { CloudflareEnv } from '../../cloudflare-env';

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

    const ipAddress = getClientIpAddress(request);
    const userAgent = request.headers.get('User-Agent') || 'unknown';

    const tracking = await ReferralTracking.create({
        userId: referrer.get('id'),
        referralCode: body.referralCode,
        status: 'pending',
        ipAddress,
        userAgent,
        referer: body.referer || request.headers.get('Referer') || null,
        meta: body.meta || {},
    });

    return jsonResponse({
        success: true,
        tracking: tracking.toJson(),
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
