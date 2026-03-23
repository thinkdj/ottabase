import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { ApiRouteContext } from './router';
import { requireAdminAccess } from '../lib/admin-guard';
import { getDevEmailTrapStore } from '../lib/email-provider';

function parseLimit(url: URL): number {
    const raw = Number(url.searchParams.get('limit') || '25');
    if (!Number.isFinite(raw) || raw <= 0) {
        return 25;
    }

    return Math.min(Math.floor(raw), 100);
}

export async function handleAdminDevMailList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) {
        return auth;
    }

    const store = getDevEmailTrapStore(context.env);
    if (!store) {
        return errorResponse('Dev email trap is not enabled', 400, { code: 'CONFIG_ERROR' });
    }

    const result = await store.listMessages({
        limit: parseLimit(context.url),
        cursor: context.url.searchParams.get('cursor') || undefined,
    });

    return jsonResponse(result);
}

export async function handleAdminDevMailClear(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) {
        return auth;
    }

    const store = getDevEmailTrapStore(context.env);
    if (!store) {
        return errorResponse('Dev email trap is not enabled', 400, { code: 'CONFIG_ERROR' });
    }

    const deleted = await store.clearMessages();
    return jsonResponse({ success: true, deleted });
}

export async function handleAdminDevMailGet(context: ApiRouteContext, id: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) {
        return auth;
    }

    const store = getDevEmailTrapStore(context.env);
    if (!store) {
        return errorResponse('Dev email trap is not enabled', 400, { code: 'CONFIG_ERROR' });
    }

    const message = await store.getMessage(id);
    if (!message) {
        return errorResponse('Message not found', 404, { code: 'NOT_FOUND' });
    }

    return jsonResponse(message);
}

export async function handleAdminDevMailDelete(context: ApiRouteContext, id: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) {
        return auth;
    }

    const store = getDevEmailTrapStore(context.env);
    if (!store) {
        return errorResponse('Dev email trap is not enabled', 400, { code: 'CONFIG_ERROR' });
    }

    await store.deleteMessage(id);
    return jsonResponse({ success: true });
}
