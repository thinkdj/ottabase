// ============================================================
// @ottabase/alerts: routes
// ============================================================
// The console's API, platform administrators only:
//
//   GET    /channels               every channel (targets masked) and the types on offer
//   POST   /channels               add one
//   PATCH  /channels/:id           change one; a secret left out is kept
//   DELETE /channels/:id           remove one; its unsent deliveries give up
//   POST   /channels/:id/test      send a test alert to it now
//   GET    /alerts                 the feed, newest first, with where each alert went
//   GET    /summary                counts for the header, sources for the form
//   POST   /deliveries/:id/retry   send a failed delivery again now
//
// And one route for the world outside the app (CI, a cron box, an uptime robot):
//
//   POST   /ingest                 `Authorization: Bearer <ALERTS_INGEST_TOKEN>`
// ============================================================

import { timingSafeEqual } from '@ottabase/utils/hmac-signature';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { Router, type Ctx } from '@ottabase/ottarouter';
import { CHANNEL_TYPES, ChannelInputError } from './channels';
import { INGEST_MAX_BYTES, INGEST_TOKEN_MIN_LENGTH } from './constants';
import { isSeverity, type Alerts } from './engine';
import { AlertsSecretError } from './secret';
import type { AlertsCaller, AlertsPackageOptions, ChannelInput } from './types';

export interface AlertsRouterOptions<Env> extends Pick<
    AlertsPackageOptions<Env>,
    'resolveCaller' | 'requireAdmin' | 'rateLimit'
> {
    alerts: Alerts<Env>;
}

/** The body as text, read up to `max` bytes and no further; null past that. */
export async function readCapped(request: Request, max: number): Promise<string | null> {
    if (!request.body) return '';
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
            await reader.cancel().catch(() => undefined);
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
}

async function bodyOf(c: Ctx<unknown>): Promise<Record<string, unknown> | null> {
    try {
        const body = (await c.req.json()) as unknown;
        return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

const invalid = (message: string) => errorResponse(message, 400, { code: 'VALIDATION_ERROR' });

export function createAlertsRouter<Env>(options: AlertsRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const { alerts } = options;

    const admin = async (c: Ctx<Env>): Promise<AlertsCaller | Response> => {
        const who = await options.resolveCaller(c.req, c.env);
        if (!who) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
        const denied = options.requireAdmin
            ? await options.requireAdmin(c, who)
            : who.platformAdmin === true
              ? null
              : errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
        return denied ?? who;
    };

    /** A refused channel input is the operator's typo: say what is wrong. Anything else stays opaque. */
    const channelError = (error: unknown) => {
        if (error instanceof ChannelInputError) return invalid(error.message);
        // A deployment without a secret to seal targets with: the operator's to fix, and safe to say.
        if (error instanceof AlertsSecretError) {
            return errorResponse(error.message, 503, { code: 'ALERTS_SECRET_MISSING', exposure: 'public' });
        }
        throw error;
    };

    router.get('/channels', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const types = Object.entries(CHANNEL_TYPES).map(([type, spec]) => ({ type, ...spec }));
        return jsonResponse({ data: { channels: await alerts.listChannels(c.env), types } });
    });

    router.post('/channels', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const body = await bodyOf(c as Ctx<unknown>);
        if (!body) return invalid('Send the channel as a JSON object');
        try {
            return jsonResponse({ data: await alerts.createChannel(c.env, body as ChannelInput) }, 201);
        } catch (error) {
            return channelError(error);
        }
    });

    router.patch('/channels/:id', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const body = await bodyOf(c as Ctx<unknown>);
        if (!body) return invalid('Send the changes as a JSON object');
        try {
            const updated = await alerts.updateChannel(c.env, c.params.id, body as ChannelInput);
            return updated
                ? jsonResponse({ data: updated })
                : errorResponse('Channel not found', 404, { code: 'NOT_FOUND' });
        } catch (error) {
            return channelError(error);
        }
    });

    router.delete('/channels/:id', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        try {
            const removed = await alerts.removeChannel(c.env, c.params.id);
            return removed
                ? jsonResponse({ data: { id: c.params.id, removed: true } })
                : errorResponse('Channel not found', 404, { code: 'NOT_FOUND' });
        } catch (error) {
            return channelError(error);
        }
    });

    router.post('/channels/:id/test', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const result = await alerts.testChannel(c.env, c.params.id);
        return result ? jsonResponse({ data: result }) : errorResponse('Channel not found', 404, { code: 'NOT_FOUND' });
    });

    router.get('/alerts', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const params = c.url.searchParams;
        const severity = params.get('severity');
        const before = Number(params.get('before'));
        const data = await alerts.feed(c.env, {
            source: params.get('source')?.trim().toLowerCase().slice(0, 48) || undefined,
            severity: isSeverity(severity) ? severity : undefined,
            before: Number.isFinite(before) && before > 0 ? before : undefined,
            limit: Number(params.get('limit')) || 50,
        });
        return jsonResponse({ data });
    });

    router.get('/summary', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        return jsonResponse({ data: await alerts.summary(c.env) });
    });

    router.post('/deliveries/:id/retry', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const delivery = await alerts.retry(c.env, c.params.id);
        return delivery
            ? jsonResponse({ data: delivery })
            : errorResponse('Only a failed delivery can be retried', 409, { code: 'NOT_RETRYABLE' });
    });

    router.post('/ingest', async (c) => {
        const token = alerts.options.ingestToken?.(c.env)?.trim();
        // No token configured, or one too short to stand up to guessing: the route does not
        // exist, as far as anyone outside can tell.
        if (!token || token.length < INGEST_TOKEN_MIN_LENGTH) {
            return errorResponse('Not found', 404, { code: 'NOT_FOUND' });
        }
        // Before the compare: the throttle is what makes guessing at the token pointless.
        const limited = await options.rateLimit?.(c.req, c.env);
        if (limited) return limited;
        const given = (c.req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
        if (!given || !timingSafeEqual(given, token))
            return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });

        const declared = Number(c.req.headers.get('content-length') ?? 0);
        if (declared > INGEST_MAX_BYTES) return errorResponse('Payload too large', 413, { code: 'PAYLOAD_TOO_LARGE' });
        const text = await readCapped(c.req, INGEST_MAX_BYTES);
        if (text === null) return errorResponse('Payload too large', 413, { code: 'PAYLOAD_TOO_LARGE' });
        let body: Record<string, unknown>;
        try {
            body = JSON.parse(text) as Record<string, unknown>;
        } catch {
            return invalid('Malformed JSON');
        }
        if (!body || typeof body !== 'object' || typeof body.title !== 'string' || !body.title.trim()) {
            return invalid('title is required');
        }
        const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
        const result = await alerts.raise(
            c.env,
            {
                // Everything from outside is `external`, so a channel can take or refuse it as one source.
                source: 'external',
                kind: str(body.kind) ?? 'event',
                severity: isSeverity(body.severity) ? body.severity : 'warning',
                status: body.status === 'resolved' ? 'resolved' : 'firing',
                title: body.title,
                body: str(body.body) ?? null,
                url: str(body.url) ?? null,
                key: str(body.key) ? `external:${str(body.key)}` : undefined,
                fields: Array.isArray(body.fields)
                    ? body.fields
                          .filter((field): field is Record<string, unknown> => !!field && typeof field === 'object')
                          .map((field) => ({ label: String(field.label ?? ''), value: String(field.value ?? '') }))
                    : undefined,
            },
            { waitUntil: (promise) => c.ctx.waitUntil(promise) },
        );
        return jsonResponse({ data: result }, 202);
    });

    return router;
}
