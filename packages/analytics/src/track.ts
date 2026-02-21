/**
 * @ottabase/analytics — Track
 *
 * Fire-and-forget event writing to Cloudflare Workers Analytics Engine.
 *
 * Two API levels:
 * - `trackEvent()` — low-level, positional blobs/doubles (like raw writeDataPoint)
 * - `trackCoreEvent()` — structured, maps named fields to fixed blob slots
 */

import type { CoreEventOptions, TrackEventOptions } from './types';

/**
 * Low-level: write a data point with positional blobs and doubles.
 * Non-blocking, never throws — failures are logged as warnings.
 *
 * @example
 * ```ts
 * trackEvent({
 *   dataset: env.OBCF_ANALYTICS_SHORTLINKS,
 *   index: shortCode,
 *   blobs: [country, userAgent, referer, fullUrl],
 *   doubles: [1],
 * });
 * ```
 */
export function trackEvent(options: TrackEventOptions): void {
    const { dataset, index, blobs, doubles } = options;
    if (!dataset) return;
    try {
        dataset.writeDataPoint({
            indexes: [index || 'unknown'],
            blobs: blobs ?? [],
            doubles: doubles ?? [1],
        });
    } catch (e) {
        console.warn('[analytics] writeDataPoint failed (non-fatal):', e);
    }
}

/**
 * Structured: write a core event with named fields mapped to fixed slots.
 *
 * Slot mapping:
 * - index1 = event name
 * - blob1  = appId
 * - blob2  = userId
 * - blob3  = country
 * - blob4  = userAgent (truncated to 200 chars)
 * - blob5  = referer
 * - blob6  = visitorId (hashed visitor fingerprint)
 * - blob7–blob11 = metadata[0]–metadata[4]
 * - double1 = value (default 1)
 *
 * @example
 * ```ts
 * trackCoreEvent({
 *   dataset: env.OBCF_ANALYTICS_CORE,
 *   event: 'button_click',
 *   appId: 'my-app',
 *   userId: session?.user?.id,
 *   country: request.headers.get('cf-connecting-country') ?? undefined,
 *   visitorId: await resolveVisitorId(request),
 *   metadata: ['/pricing', 'cta-signup'],
 * });
 * ```
 */
export function trackCoreEvent(options: CoreEventOptions): void {
    const { dataset, event, appId, userId, country, userAgent, referer, visitorId, metadata, value } = options;
    if (!dataset) return;

    // Build blob array with fixed slot positions
    const blobs: string[] = [
        appId ?? '',
        userId ?? '',
        country ?? 'unknown',
        (userAgent ?? '').slice(0, 200),
        referer ?? '',
        visitorId ?? '',
    ];

    // Append up to 5 metadata strings (blob7–blob11)
    if (metadata) {
        for (let i = 0; i < Math.min(metadata.length, 5); i++) {
            blobs.push(metadata[i] ?? '');
        }
    }

    trackEvent({
        dataset,
        index: event,
        blobs,
        doubles: [value ?? 1],
    });
}

/**
 * Extract common request context for tracking.
 * Convenience helper to avoid repeating header reads.
 *
 * @example
 * ```ts
 * const ctx = extractRequestContext(request);
 * trackCoreEvent({ dataset, event: 'page_view', ...ctx, appId: 'my-app' });
 * ```
 */
export function extractRequestContext(request: Request): {
    country: string;
    userAgent: string;
    referer: string;
} {
    return {
        country: request.headers.get('cf-connecting-country') ?? 'unknown',
        userAgent: (request.headers.get('user-agent') ?? '').slice(0, 200),
        referer: request.headers.get('referer') ?? '',
    };
}
