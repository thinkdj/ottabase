import { getSession } from '@ottabase/auth/backend';
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getAuthOptions } from '../lib/auth-utils';
import { enforceRateLimit } from '../lib/rate-limiting';
import type { ApiRouteContext } from './router';

/** Bounds on one broadcast, so a signed-in caller cannot turn the demo into a fan-out amplifier. */
const MAX_CHANNELS = 10;
const MAX_NAME_LENGTH = 64;
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Any signed-in user may use the realtime demo, each in a private room: one Durable Object per
 * user (`user:<id>`). Two tabs of the same account see each other's messages; nobody can read,
 * list or spam another account's channels. Returns the room name, or the 401 to send.
 */
async function resolveRoom(context: ApiRouteContext): Promise<{ userId: string; room: string } | Response> {
    const session = await getSession(context.request, context.env as any, getAuthOptions(context.env));
    const userId = session?.user?.id;
    if (!userId) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    return { userId, room: `user:${userId}` };
}

function realtimeUnavailable(): Response {
    return errorResponse('Realtime is not available in this environment', 501, {
        details: 'The Durable Object binding (OBCF_REALTIME) is not configured.',
        hint: 'Deploy with `wrangler deploy` to enable Durable Objects.',
        code: 'CONFIG_ERROR',
    });
}

function isBoundedName(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH;
}

export async function handleRealtimeWebsocket(context: ApiRouteContext): Promise<Response | null> {
    const caller = await resolveRoom(context);
    if (caller instanceof Response) return caller;

    const { request, env } = context;
    if (!env.OBCF_REALTIME) return realtimeUnavailable();

    if (request.headers.get('Upgrade') !== 'websocket') {
        return errorResponse('Expected WebSocket upgrade', 426, {
            code: 'UPGRADE_REQUIRED',
        });
    }

    const limited = await enforceRateLimit(request, env, `realtime:connect:${caller.userId}`);
    if (limited) return limited;

    const stub = env.OBCF_REALTIME.get(env.OBCF_REALTIME.idFromName(caller.room));
    return stub.fetch(request as any) as unknown as Response;
}

export async function handleRealtimeBroadcast(context: ApiRouteContext): Promise<Response> {
    const caller = await resolveRoom(context);
    if (caller instanceof Response) return caller;

    const { request, env } = context;
    if (!env.OBCF_REALTIME) return realtimeUnavailable();

    const limited = await enforceRateLimit(request, env, `realtime:broadcast:${caller.userId}`);
    if (limited) return limited;

    const raw = await request.text().catch(() => '');
    if (raw.length > MAX_BODY_BYTES) {
        return errorResponse('Broadcast payload is too large', 413, { code: 'PAYLOAD_TOO_LARGE' });
    }
    let body: unknown = {};
    try {
        body = raw ? JSON.parse(raw) : {};
    } catch {
        return errorResponse('Request body must be JSON', 400, { code: 'INVALID_JSON' });
    }
    const { channels, event, data, persistForOffline } = body as {
        channels?: unknown;
        event?: unknown;
        data?: unknown;
        persistForOffline?: boolean;
    };

    if (!Array.isArray(channels) || channels.length === 0) {
        return errorResponse('channels array is required', 400);
    }
    if (channels.length > MAX_CHANNELS || !channels.every(isBoundedName)) {
        return errorResponse(`Up to ${MAX_CHANNELS} channels of at most ${MAX_NAME_LENGTH} characters`, 400, {
            code: 'INVALID_CHANNELS',
        });
    }
    if (!isBoundedName(event)) {
        return errorResponse(`event is required (at most ${MAX_NAME_LENGTH} characters)`, 400);
    }

    const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME, caller.room);
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
    const caller = await resolveRoom(context);
    if (caller instanceof Response) return caller;

    const { env } = context;
    if (!env.OBCF_REALTIME) return realtimeUnavailable();

    const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME, caller.room);
    const stats = await broadcaster.getStats();
    return jsonResponse(
        stats ?? {
            totalConnections: 0,
            channels: [],
            offlineMessagesQueued: 0,
        },
    );
}
