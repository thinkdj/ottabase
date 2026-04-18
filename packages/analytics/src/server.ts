/**
 * @ottabase/analytics — Server Route Handler
 *
 * Drop-in `POST /api/analytics/track` endpoint for Cloudflare Workers.
 * Accepts events from client-side JS and writes them to WAE via `trackCoreEvent`.
 *
 * @example
 * ```ts
 * // In your worker router:
 * import { handleAnalyticsTrack } from '@ottabase/analytics/server';
 *
 * if (route === '/api/analytics/track' && method === 'POST') {
 *   return handleAnalyticsTrack({ request, env, dataset: env.OBCF_ANALYTICS_CORE });
 * }
 * ```
 */

import { resolveVisitorId } from './identity';
import { extractRequestContext, trackCoreEvent } from './track';
import type { TrackEndpointBody } from './types';

export interface AnalyticsTrackContext {
    request: Request;
    /** The WAE dataset to write to. */
    dataset: AnalyticsEngineDataset | undefined;
    /** Default appId if not provided in the body (e.g. `env.APP_ID`). */
    defaultAppId?: string;
    /** Authenticated userId if available. */
    userId?: string;
}

/**
 * Handle `POST /api/analytics/track`.
 *
 * Expects JSON body: `{ event, appId?, metadata?, value? }`
 * Automatically extracts visitor ID, country, UA, and referer from the request.
 *
 * Returns `{ ok: true }` on success. Non-blocking write — always responds quickly.
 */
export async function handleAnalyticsTrack(ctx: AnalyticsTrackContext): Promise<Response> {
    const { request, dataset, defaultAppId, userId } = ctx;

    if (!dataset) {
        return new Response(JSON.stringify({ error: 'Analytics not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let body: TrackEndpointBody;
    try {
        body = (await request.json()) as TrackEndpointBody;
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!body.event || typeof body.event !== 'string') {
        return new Response(JSON.stringify({ error: 'event is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Resolve visitor identity (async, uses pluggable resolver)
    const visitorId = await resolveVisitorId(request);
    const reqCtx = extractRequestContext(request);

    trackCoreEvent({
        dataset,
        event: body.event,
        appId: body.appId ?? defaultAppId ?? '',
        userId: userId ?? '',
        ...reqCtx,
        visitorId,
        metadata: body.metadata,
        value: body.value,
    });

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
