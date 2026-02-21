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

/** Returns the maximum number of post-setup username changes allowed (default: 1). */
function getMaxUsernameChanges(env: CloudflareEnv): number {
    return parseInt((env as any).REFERRAL_SYSTEM_USERNAME_CHANGE ?? '1', 10);
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

    // Duplicate-click deduplication via KV
    const dedupWindowMin = parseInt((env as any).REFERRAL_DEDUP_WINDOW_MINUTES ?? '20', 10);
    if (dedupWindowMin > 0 && env.OBCF_KV) {
        const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
        const dedupKey = `ref:dedup:${ip}:${body.referralCode}`;
        try {
            const existing = await env.OBCF_KV.get(dedupKey);
            if (existing !== null) {
                // Duplicate within window – return success silently (don't count the click twice)
                return jsonResponse({
                    success: true,
                    tracking: { referralCode: body.referralCode, recorded: false, deduplicated: true },
                });
            }
            // Store dedup marker – fire-and-forget, don't let KV failure block tracking
            env.OBCF_KV.put(dedupKey, '1', { expirationTtl: dedupWindowMin * 60 }).catch((e) => {
                console.warn('ref:dedup KV write failed:', e);
            });
        } catch {
            // KV unavailable – proceed without dedup
        }
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
            referralUsernameChanges: (user.get('referralUsernameChanges') as number) ?? 0,
        },
        usernameChangeLimit: getMaxUsernameChanges(env),
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

    const { validateUsername } = await import('@ottabase/referrals');
    const validation = validateUsername(body.referralUsername);

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

    // Enforce change limit: first-time setting is free; subsequent changes are limited.
    const maxChanges = getMaxUsernameChanges(env);
    const currentUsername = user.get('referralUsername');
    if (currentUsername) {
        // This is a change (not initial setup)
        const changesMade = (user.get('referralUsernameChanges') as number) ?? 0;
        if (changesMade >= maxChanges) {
            return errorResponse(
                `Referral username can only be changed ${maxChanges} time${maxChanges === 1 ? '' : 's'} after initial setup`,
                400,
                { code: 'USERNAME_CHANGE_LIMIT_REACHED' },
            );
        }
        user.set('referralUsernameChanges', changesMade + 1);
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

/** Escape a CSV field (quote if it contains comma, newline or double-quote). */
function csvField(value: unknown): string {
    const str = value == null ? '' : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Handle GET /api/referrals/export?format=csv
 * Downloads all of the authenticated user's referral tracking records as a CSV file.
 */
export async function handleReferralExport(context: ReferralRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const records = await ReferralTracking.forUser(userId);

    const header = 'id,referralCode,referredUserId,status,ipAddress,userAgent,referer,createdAt,conversionAt\r\n';
    const rows = records.map((t) => {
        const d = t.toJson() as Record<string, unknown>;
        return [
            csvField(d.id),
            csvField(d.referralCode),
            csvField(d.referredUserId),
            csvField(d.status),
            csvField(d.ipAddress),
            csvField(d.userAgent),
            csvField(d.referer),
            csvField(d.createdAt),
            csvField(d.conversionAt),
        ].join(',');
    });

    const csv = header + rows.join('\r\n');
    const today = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="referrals-${today}.csv"`,
        },
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

/**
 * Handle GET /r/{username} — vanity referral redirect
 *
 * Returns a lightweight HTML page with:
 * - Open Graph meta tags (for social link previews)
 * - <meta http-equiv="refresh"> redirect
 * - JavaScript redirect fallback
 *
 * This makes `/r/johndoe` work like `/?ref=johndoe` while giving clean,
 * shareable URLs with proper social preview cards.
 */
export async function handleReferralVanityRedirect(
    context: { request: Request; env: CloudflareEnv; url: URL },
    username: string,
): Promise<Response | null> {
    const { env, url } = context;

    if (!username || !env.OBCF_D1) return null;

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const user = await User.findByReferralUsername(username);
    if (!user) return null; // fall through to 404 / SPA

    const displayName: string = (user.get('name') as string | null) || username;
    const origin = url.origin;
    const destination = `${origin}/?ref=${encodeURIComponent(username)}`;

    // Escape helper – avoid XSS in injected content
    const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const title = esc(`Join ${displayName}'s referral`);
    const description = esc(`${displayName} invited you. Sign up using their referral link.`);
    const escapedDest = esc(destination);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${esc(url.toString())}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta http-equiv="refresh" content="0;url=${escapedDest}">
</head>
<body>
<p>Redirecting… <a href="${escapedDest}">Click here if not redirected</a></p>
<script>window.location.replace(${JSON.stringify(destination)});</script>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
