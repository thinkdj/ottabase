import { AnalyticsQueryError, queryEvents, validateAnalyticsConfig } from '@ottabase/analytics/query';
import { getSession } from '@ottabase/auth/backend';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { ApiRouteContext } from './router';
import { getAuthOptions } from '../lib/auth-utils';

/**
 * Handle GET /api/analytics/core - query WAE for core event analytics
 * Requires auth. Params: event (optional), days (default 7), groupBy (event|country|day)
 * core_events schema: index1=event, blob1=appId, blob2=userId, blob3=country
 */
export async function handleCoreAnalytics(context: ApiRouteContext): Promise<Response> {
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

    const eventFilter = url.searchParams.get('event') ?? '';
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '7', 10)));
    const groupBy = url.searchParams.get('groupBy') ?? 'event';

    // core_events: index1=event, blob3=country. Map to query column names.
    const groupByMap: Record<string, string> = {
        event: 'index',
        country: 'blob3',
        day: 'day',
    };
    const resolvedGroupBy = groupByMap[groupBy];
    if (!resolvedGroupBy) {
        return errorResponse('Invalid groupBy: use event, country, or day', 400, { code: 'INVALID_GROUPBY' });
    }

    try {
        const result = await queryEvents(
            { accountId: env.CLOUDFLARE_ACCOUNT_ID!, apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN! },
            {
                dataset: 'core_events',
                indexFilter: eventFilter || undefined,
                days,
                groupBy: resolvedGroupBy,
                limit: groupBy === 'day' ? 90 : 100,
            },
        );

        return jsonResponse({
            data: result.data,
            meta: { groupBy, days, event: eventFilter || null },
        });
    } catch (e) {
        if (e instanceof AnalyticsQueryError) {
            return errorResponse('Analytics query failed', 502, { code: 'ANALYTICS_ERROR', details: e.detail });
        }
        throw e;
    }
}
