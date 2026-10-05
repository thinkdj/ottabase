import { AnalyticsQueryError, queryEvents, validateAnalyticsConfig } from '@ottabase/analytics/query';
import { getRequestCountry, trackEvent } from '@ottabase/analytics/track';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Shortlink, buildRedirectResponse, generateShortCode } from '@ottabase/shortlinks';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parseBoundedInteger, parsePaginationParams } from '@ottabase/utils/pagination';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { requireAdminAccess } from '../lib/admin-guard';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

export interface ShortlinkContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

/** Push shortlink click to Analytics Engine (non-blocking; never throws) */
function pushShortlinkClick(env: CloudflareEnv, request: Request, shortCode: string, fullUrl: string): void {
    if (!env.OBCF_ANALYTICS_SHORTLINKS) return;
    trackEvent({
        dataset: env.OBCF_ANALYTICS_SHORTLINKS,
        index: shortCode,
        blobs: [
            getRequestCountry(request),
            (request.headers.get('user-agent') ?? '').slice(0, 200),
            request.headers.get('referer') ?? '',
            fullUrl ?? '',
        ],
    });
}

export async function handleShortlinksList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    // requireAdminAccess() above already ran initDbConnection(env), which registers the
    // 'default' connection — no need to construct another D1Driver and re-register it here.

    const { page, perPage, orderBy, order, search } = parsePaginationParams(url.searchParams);
    const appId = url.searchParams.get('appId');
    const type = url.searchParams.get('type');
    const where: Record<string, unknown> = {};
    if (appId) where.appId = appId;
    if (type) where.type = type;

    const filter = Object.keys(where).length > 0 ? where : undefined;
    const options = { orderBy, orderDirection: order };
    const paginationResult = search
        ? await Shortlink.searchPaginate(search, ['shortCode', 'fullUrl'], page, perPage, filter, options)
        : await Shortlink.paginate(page, perPage, filter, options);

    return paginatedJsonResponse({
        data: paginationResult.data.map((s) => s.toJson()),
        total: paginationResult.total,
        page: paginationResult.page,
        perPage: paginationResult.perPage,
        path: '/api/shortlinks',
    });
}

/** A generated code nobody holds yet. A clash is rare, so a few draws are plenty. */
async function freeShortCode(): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateShortCode();
        if (!(await Shortlink.findByCode(code))) return code;
    }
    return null;
}

export async function handleShortlinksCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, request } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    // requireAdminAccess() above already ran initDbConnection(env), which registers the
    // 'default' connection — no need to construct another D1Driver and re-register it here.

    const body = await readJson<{
        fullUrl?: string;
        shortCode?: string;
        type?: string;
        appId?: string;
        expiryDate?: string | null;
        interstitialEnabled?: boolean;
        interstitialSeconds?: number | null;
    }>(request);

    if (!body.fullUrl) {
        return errorResponse('fullUrl is required', 400);
    }

    let shortCode = body.shortCode?.trim();
    if (shortCode) {
        if (await Shortlink.findByCode(shortCode)) {
            return errorResponse('Short code already exists', 409, {
                code: 'DUPLICATE_SHORT_CODE',
            });
        }
    } else {
        const generated = await freeShortCode();
        if (!generated) return errorResponse('Could not find a free short code, try again', 503);
        shortCode = generated;
    }

    try {
        const expiryDate = body.expiryDate ? new Date(body.expiryDate).getTime() : null;
        const shortlink = await Shortlink.create({
            fullUrl: body.fullUrl,
            shortCode,
            type: body.type || 'redirect',
            appId: body.appId || 'default',
            expiryDate: Number.isNaN(expiryDate) ? null : expiryDate,
            interstitialEnabled: body.interstitialEnabled ?? false,
            interstitialSeconds: body.interstitialSeconds ?? null,
        });

        return jsonResponse({
            success: true,
            data: shortlink.toJson(),
        });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create shortlink', 400, {
            code: 'VALIDATION_ERROR',
        });
    }
}

export async function handleShortlinkById(
    context: ApiRouteContext,
    id: string,
    method: 'PATCH' | 'DELETE',
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, request } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    // requireAdminAccess() above already ran initDbConnection(env), which registers the
    // 'default' connection — no need to construct another D1Driver and re-register it here.

    if (method === 'PATCH') {
        const body = await readJson<{
            fullUrl?: string;
            shortCode?: string;
            type?: string;
            expiryDate?: string | null;
            interstitialEnabled?: boolean;
            interstitialSeconds?: number | null;
        }>(request);

        const shortlink = await Shortlink.find(id);
        if (!shortlink) {
            return errorResponse('Shortlink not found', 404);
        }

        if (body.shortCode && body.shortCode !== shortlink.get('shortCode')) {
            const existing = await Shortlink.findByCode(body.shortCode);
            if (existing) {
                return errorResponse('Short code already exists', 409, {
                    code: 'DUPLICATE_SHORT_CODE',
                });
            }
            shortlink.set('shortCode', body.shortCode);
        }

        if (body.fullUrl) shortlink.set('fullUrl', body.fullUrl);
        if (body.type) shortlink.set('type', body.type);
        if (body.expiryDate !== undefined) {
            const expiryDate = body.expiryDate ? new Date(body.expiryDate).getTime() : null;
            shortlink.set('expiryDate', Number.isNaN(expiryDate) ? null : expiryDate);
        }
        if (body.interstitialEnabled !== undefined) shortlink.set('interstitialEnabled', body.interstitialEnabled);
        if (body.interstitialSeconds !== undefined) shortlink.set('interstitialSeconds', body.interstitialSeconds);

        try {
            await shortlink.save();
            return jsonResponse({
                success: true,
                data: shortlink.toJson(),
            });
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to update shortlink', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
    }

    const shortlink = await Shortlink.find(id);
    if (!shortlink) {
        return errorResponse('Shortlink not found', 404);
    }

    await Shortlink.delete(id);
    return jsonResponse({
        success: true,
        message: 'Shortlink deleted successfully',
    });
}

export async function handleShortlinkExplicitGo(context: ShortlinkContext): Promise<Response> {
    const { request, env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const code = url.searchParams.get('code') || url.searchParams.get('s') || url.searchParams.get('id');
    if (!code) {
        return errorResponse('Missing shortlink code', 400, {
            hint: 'Use /shortlinks/go?code=... or ?s=...',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    try {
        const shortlink = await Shortlink.findByCode(code);

        if (!shortlink) {
            return errorResponse('Shortlink not found', 404, {
                code: 'LINK_NOT_FOUND',
            });
        }

        pushShortlinkClick(env, request, shortlink.get('shortCode') ?? 'unknown', shortlink.get('fullUrl') ?? '');
        return buildRedirectResponse(shortlink);
    } catch (error) {
        console.error(
            JSON.stringify({
                event: 'shortlink_redirect_failed',
                error: redactErrorForLog(error),
            }),
        );
        return errorResponse('Failed to process shortlink', 500);
    }
}

export async function handleShortlinkFallback(context: ShortlinkContext): Promise<Response | null> {
    const { env, request, url } = context;

    if (!getOttabaseConfig(env).packages.shortlinks) {
        return null;
    }

    if (
        !env.OBCF_D1 ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/@') ||
        url.pathname === '/' ||
        /\.[a-zA-Z0-9]+$/.test(url.pathname)
    ) {
        return null;
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const shortCode = url.pathname.substring(1);
    const shortlink = await Shortlink.findByCode(shortCode);
    if (!shortlink) {
        return null;
    }

    pushShortlinkClick(env, request, shortlink.get('shortCode') ?? 'unknown', shortlink.get('fullUrl') ?? '');
    return buildRedirectResponse(shortlink);
}

/**
 * Handle GET /api/shortlinks/analytics - query WAE for click analytics
 * Requires a system-scope admin. Params: shortCode (optional), days (default 7), groupBy (country|shortCode|day)
 */
export async function handleShortlinksAnalytics(context: ShortlinkContext): Promise<Response> {
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

    const shortCode = url.searchParams.get('shortCode') ?? '';
    const days = parseBoundedInteger(url.searchParams.get('days'), 7, 1, 90);
    const groupBy = url.searchParams.get('groupBy') ?? 'country';

    // Map shortCode-specific groupBy to generic groupBy shortcuts
    const groupByMap: Record<string, string> = { country: 'country', shortCode: 'index', day: 'day' };
    const resolvedGroupBy = groupByMap[groupBy];
    if (!resolvedGroupBy) {
        return errorResponse('Invalid groupBy: use country, shortCode, or day', 400, { code: 'INVALID_GROUPBY' });
    }

    try {
        const result = await queryEvents(
            { accountId: env.CLOUDFLARE_ACCOUNT_ID!, apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN! },
            {
                dataset: 'shortlink_clicks',
                indexFilter: shortCode || undefined,
                days,
                groupBy: resolvedGroupBy,
                limit: groupBy === 'day' ? 90 : 100,
            },
        );

        return jsonResponse({
            data: result.data,
            meta: { groupBy, days, shortCode: shortCode || null },
        });
    } catch (e) {
        if (e instanceof AnalyticsQueryError) {
            return errorResponse('Analytics query failed', 502, { code: 'ANALYTICS_ERROR', details: e.detail });
        }
        throw e;
    }
}
