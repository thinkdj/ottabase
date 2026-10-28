// ============================================================
// @ottabase/webhooks — API routes
// ============================================================
// Mounted by the kernel at `/api/webhooks`. Every route resolves the caller from the
// host's session and filters by the caller's tenant.
// ============================================================

import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { WEBHOOKS_DELIVERY_PAGE_SIZE } from './constants';
import { deliverToEndpoint } from './dispatch';
import { WebhookDelivery } from './ottaorm-models/WebhookDelivery';
import { WebhookEndpoint } from './ottaorm-models/WebhookEndpoint';
import { generateSigningSecret } from './signing';
import type { WebhookCaller, WebhookEndpointInput, WebhooksRouterConfig } from './types';
import { WebhookUrlError, assertDeliverableUrl } from './url-policy';

/** Events offered in the UI when the host does not supply its own catalog. */
export const DEFAULT_WEBHOOK_EVENTS = ['ping'];

async function readJsonBody<T>(request: Request): Promise<T> {
    try {
        return ((await request.json()) as T) ?? ({} as T);
    } catch {
        return {} as T;
    }
}

/**
 * Tenant filter for every query.
 *
 * Built from the RESOLVED caller, never from request input — this is the only thing
 * standing between two customers' endpoint lists, so it does not take a parameter a
 * client could set.
 */
function tenantFilter(caller: WebhookCaller): Record<string, unknown> {
    const filter: Record<string, unknown> = { appId: caller.appId };
    // A null organizationId is a real, distinct scope (personal endpoints), so it is
    // matched exactly rather than dropped from the filter — dropping it would widen the
    // query to every organization.
    filter.organizationId = caller.organizationId;
    if (caller.organizationId === null) filter.userId = caller.userId;
    return filter;
}

function tenantScopeError(caller: WebhookCaller): Response | null {
    if (!caller.appId || (caller.organizationId === null && !caller.userId)) {
        return errorResponse('Forbidden', 403);
    }
    return null;
}

function normalizeEvents(input: unknown): string[] {
    if (!Array.isArray(input)) return ['*'];
    const events = input
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 50);
    return events.length > 0 ? [...new Set(events)] : ['*'];
}

export function createWebhooksRouter<Env>(config: WebhooksRouterConfig<Env>): Router<Env> {
    const router = new Router<Env>();
    const events = config.events ?? DEFAULT_WEBHOOK_EVENTS;

    /** Resolve the caller or produce the 401. Every route starts here. */
    const caller = async (request: Request, env: Env): Promise<WebhookCaller | Response> =>
        (await config.resolveCaller(request, env)) ?? errorResponse('Unauthorized', 401);

    // ── The event catalog ────────────────────────────────────────
    router.get('/events', () => jsonResponse({ data: events }));

    // ── Endpoints ────────────────────────────────────────────────
    router.get('/', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const scopeError = tenantScopeError(who);
        if (scopeError) return scopeError;

        const endpoints = (await WebhookEndpoint.where(tenantFilter(who))) as WebhookEndpoint[];
        return jsonResponse({ data: endpoints.map((endpoint) => endpoint.toView()) });
    });

    router.post('/', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const scopeError = tenantScopeError(who);
        if (scopeError) return scopeError;
        if (!who.canManage) return errorResponse('Forbidden', 403);

        const body = await readJsonBody<WebhookEndpointInput>(c.req);
        if (typeof body.url !== 'string' || !body.url.trim()) {
            return errorResponse('A destination URL is required', 400, { code: 'URL_REQUIRED' });
        }

        let url: string;
        try {
            url = assertDeliverableUrl(body.url);
        } catch (error) {
            if (error instanceof WebhookUrlError) {
                return errorResponse(error.message, 400, { code: 'INVALID_URL' });
            }
            throw error;
        }

        const secret = generateSigningSecret();
        const endpoint = (await WebhookEndpoint.create({
            url,
            description: typeof body.description === 'string' ? body.description.slice(0, 200) : null,
            events: normalizeEvents(body.events),
            secret,
            enabled: body.enabled ?? true,
            // Tenancy is stamped from the resolved caller, never from the request body.
            organizationId: who.organizationId,
            userId: who.userId,
            appId: who.appId,
        })) as WebhookEndpoint;

        // The ONLY response that ever carries the secret. A receiver cannot verify
        // signatures without it, and storing it reversibly for later display would make
        // every subsequent read a place it can leak.
        return jsonResponse({ data: { ...endpoint.toView(), secret } }, 201);
    });

    router.patch('/:id', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const scopeError = tenantScopeError(who);
        if (scopeError) return scopeError;
        if (!who.canManage) return errorResponse('Forbidden', 403);

        const endpoint = await findOwned(c.params.id, who);
        if (!endpoint) return errorResponse('Endpoint not found', 404);

        const body = await readJsonBody<WebhookEndpointInput>(c.req);

        if (typeof body.url === 'string') {
            try {
                endpoint.set('url', assertDeliverableUrl(body.url));
            } catch (error) {
                if (error instanceof WebhookUrlError) {
                    return errorResponse(error.message, 400, { code: 'INVALID_URL' });
                }
                throw error;
            }
        }
        if (body.description !== undefined) {
            endpoint.set('description', typeof body.description === 'string' ? body.description.slice(0, 200) : null);
        }
        if (body.events !== undefined) endpoint.set('events', normalizeEvents(body.events));
        if (body.enabled !== undefined) endpoint.set('enabled', Boolean(body.enabled));

        await endpoint.save();
        return jsonResponse({ data: endpoint.toView() });
    });

    router.delete('/:id', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const scopeError = tenantScopeError(who);
        if (scopeError) return scopeError;
        if (!who.canManage) return errorResponse('Forbidden', 403);

        const endpoint = await findOwned(c.params.id, who);
        if (!endpoint) return errorResponse('Endpoint not found', 404);

        await WebhookEndpoint.delete(c.params.id);
        return jsonResponse({ data: { deleted: true, id: c.params.id } });
    });

    /** Send a signed test delivery. */
    router.post('/:id/test', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const scopeError = tenantScopeError(who);
        if (scopeError) return scopeError;
        if (!who.canManage) return errorResponse('Forbidden', 403);

        const endpoint = await findOwned(c.params.id, who);
        if (!endpoint) return errorResponse('Endpoint not found', 404);

        const deliveryId = crypto.randomUUID();
        const body = JSON.stringify({
            id: deliveryId,
            event: 'ping',
            createdAt: Date.now(),
            data: { message: 'Test delivery from Ottabase' },
        });

        const outcome = await deliverToEndpoint(endpoint, 'ping', body, deliveryId);
        await endpoint.recordDelivery(outcome);
        return jsonResponse({ data: outcome });
    });

    // ── Delivery history ─────────────────────────────────────────
    router.get('/deliveries', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const scopeError = tenantScopeError(who);
        if (scopeError) return scopeError;

        const endpointId = c.url.searchParams.get('endpointId');
        const filter = tenantFilter(who);
        if (endpointId) filter.endpointId = endpointId;

        const page = await WebhookDelivery.paginate(1, WEBHOOKS_DELIVERY_PAGE_SIZE, filter, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });

        return jsonResponse({
            data: (page.data as WebhookDelivery[]).map((delivery) => delivery.toView()),
            meta: { total: page.total, perPage: page.perPage },
        });
    });

    return router;
}

/**
 * Load an endpoint that belongs to the caller's tenant.
 *
 * The tenant filter is applied on the LOOKUP, not checked afterwards: a find-then-compare
 * is one forgotten `return` away from a cross-tenant read, and this is the only place the
 * id comes from the URL.
 */
async function findOwned(id: string, who: WebhookCaller): Promise<WebhookEndpoint | null> {
    const matches = (await WebhookEndpoint.where({ ...tenantFilter(who), id })) as WebhookEndpoint[];
    return matches[0] ?? null;
}
