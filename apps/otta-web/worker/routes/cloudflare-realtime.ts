import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

export interface RealtimeRouteContext {
    request: Request;
    env: CloudflareEnv;
}

export async function handleRealtimeWebsocket(context: ApiRouteContext): Promise<Response | null> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env } = context;
    if (!env.OBCF_REALTIME) {
        return errorResponse('Realtime is not available in this environment', 501, {
            details: 'The Durable Object binding (OBCF_REALTIME) is not configured.',
            hint: 'Deploy with `wrangler deploy` to enable Durable Objects.',
            code: 'CONFIG_ERROR',
        });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
        return errorResponse('Expected WebSocket upgrade', 426, {
            code: 'UPGRADE_REQUIRED',
        });
    }

    const id = env.OBCF_REALTIME.idFromName('global');
    const stub = env.OBCF_REALTIME.get(id);
    return stub.fetch(request as any) as unknown as Response;
}

export async function handleRealtimeBroadcast(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env } = context;

    if (!env.OBCF_REALTIME) {
        return errorResponse('Realtime is not available in this environment', 501, {
            code: 'CONFIG_ERROR',
        });
    }

    const body = await request.json().catch(() => ({}));
    const { channels, event, data, persistForOffline } = body as {
        channels?: string[];
        event?: string;
        data?: unknown;
        persistForOffline?: boolean;
    };

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
        return errorResponse('channels array is required', 400);
    }
    if (!event) {
        return errorResponse('event is required', 400);
    }

    const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
    const result = await broadcaster.broadcast({
        channels,
        event,
        data,
        persistForOffline: persistForOffline ?? false,
        metadata: { sentAt: Date.now(), source: 'api' },
    });

    if (!result.success) {
        return errorResponse('Failed to broadcast message', 500, {
            details: result.error,
        });
    }

    return jsonResponse({
        success: true,
        channelsCount: channels.length,
    });
}

export async function handleRealtimeStats(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env } = context;
    if (!env.OBCF_REALTIME) {
        return errorResponse('Realtime is not available in this environment', 501, {
            code: 'CONFIG_ERROR',
        });
    }

    const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
    const stats = await broadcaster.getStats();
    return jsonResponse(
        stats ?? {
            totalConnections: 0,
            channels: [],
            offlineMessagesQueued: 0,
        },
    );
}
