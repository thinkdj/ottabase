import { getSession } from '@ottabase/auth/backend';
import { NotificationModel, NotificationPreference } from '@ottabase/notifications';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { parsePaginationParams } from '@ottabase/utils/pagination';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import { NOTIFICATION_CATEGORIES } from '../lib/notify';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

const UNREAD = { status: { $ne: 'read' } };

/** The signed-in user's id, or the 401 to send back */
async function requireUserId(context: ApiRouteContext): Promise<string | Response> {
    const session = await getSession(context.request, context.env as any, getAuthOptions(context.env));
    const userId = session?.user?.id as string | undefined;
    if (!userId) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    initDbConnection(context.env);
    return userId;
}

/** GET /api/notifications?page=1&perPage=20&unread=1: my inbox, newest first, with the unread count */
export async function handleNotificationsList(context: ApiRouteContext): Promise<Response> {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;

    const { page, perPage } = parsePaginationParams(context.url.searchParams, { defaults: { perPage: 20 } });
    const unreadOnly = context.url.searchParams.get('unread') === '1';
    const [result, unread] = await Promise.all([
        NotificationModel.paginate(page, Math.min(perPage, 50), unreadOnly ? { userId, ...UNREAD } : { userId }, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        }),
        NotificationModel.count({ userId, ...UNREAD }),
    ]);

    return jsonResponse({
        data: result.data.map((row) => row.toJson()),
        pagination: {
            page: result.page,
            perPage: result.perPage,
            total: result.total,
            totalPages: result.totalPages,
            next: null,
            prev: null,
        },
        unread,
    });
}

/** POST /api/notifications/read { ids?: string[] }: these notifications, or every unread one */
export async function handleNotificationsMarkRead(context: ApiRouteContext): Promise<Response> {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;

    const body = await readJson<{ ids?: unknown }>(context.request);
    const ids = Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 100)
        : null;
    if (ids && ids.length === 0) return jsonResponse({ updated: 0 });

    const rows = await NotificationModel.where(
        { userId, ...UNREAD, ...(ids ? { id: { $in: ids } } : {}) },
        { limit: 500 },
    );
    await Promise.all(rows.map((row) => row.markAsRead()));
    return jsonResponse({ updated: rows.length });
}

function preferencesJson(prefs: InstanceType<typeof NotificationPreference> | null) {
    return {
        categories: Object.fromEntries(
            Object.entries(NOTIFICATION_CATEGORIES).map(([key, label]) => [
                key,
                { label, enabled: prefs ? prefs.isCategoryEnabled(key) : true },
            ]),
        ),
    };
}

/** GET or PUT /api/notifications/preferences: which kinds of notification reach my inbox */
export async function handleNotificationPreferences(context: ApiRouteContext): Promise<Response> {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;

    if (context.request.method === 'PUT') {
        const body = await readJson<{ categories?: Record<string, unknown> }>(context.request);
        const prefs = await NotificationPreference.getOrCreate(userId);
        for (const category of Object.keys(NOTIFICATION_CATEGORIES)) {
            const value = body.categories?.[category];
            if (typeof value === 'boolean') await prefs.setCategoryPreference(category, value);
        }
        return jsonResponse(preferencesJson(prefs));
    }

    return jsonResponse(preferencesJson(await NotificationPreference.first({ userId })));
}
