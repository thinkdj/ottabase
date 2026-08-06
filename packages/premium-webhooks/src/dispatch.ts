// ============================================================
// @ottabase/premium-webhooks — outbound delivery
// ============================================================
// One call from anywhere in the host app:
//
//     await dispatchWebhookEvent({ registry, env, event: 'todo.created', payload, tenant });
//
// DELIVERY IS BEST-EFFORT AND SINGLE-ATTEMPT. Retries with backoff belong in a queue
// (`@ottabase/queue`), not in a fetch loop inside a request: a retry loop on the request
// path turns one slow customer endpoint into the host app's latency. `deliverToEndpoint`
// is exported so a queue consumer can own the retry policy.
// ============================================================

import type { PremiumRegistry } from '@ottabase/premium';
import { WEBHOOKS_FEATURE_DELIVERY_LOG, WEBHOOKS_PACKAGE_KEY } from './constants';
import { WebhookDelivery } from './ottaorm-models/WebhookDelivery';
import { WebhookEndpoint } from './ottaorm-models/WebhookEndpoint';
import { DELIVERY_HEADER, EVENT_HEADER, SIGNATURE_HEADER, buildSignatureHeader } from './signing';
import type { WebhookTenant } from './types';

/** Hard ceiling on one delivery attempt. A customer's slow endpoint is not the app's problem. */
export const DELIVERY_TIMEOUT_MS = 8_000;

export interface DeliveryOutcome {
    endpointId: string;
    ok: boolean;
    statusCode: number | null;
    error: string | null;
    durationMs: number;
}

/**
 * Reduce any failure to a short, bounded string.
 *
 * Never the raw thrown value: a fetch error can carry the full request — including the
 * signed body and the customer's URL with whatever is in its query string — straight
 * into a log sink and a database column.
 */
export function summarizeDeliveryError(error: unknown): string {
    if (error instanceof DOMException && error.name === 'AbortError') return 'timeout';
    if (error instanceof Error) return error.name === 'Error' ? 'request failed' : error.name;
    return 'request failed';
}

/** POST one signed payload to one endpoint. Never throws — failures come back as an outcome. */
export async function deliverToEndpoint(
    endpoint: WebhookEndpoint,
    event: string,
    body: string,
    deliveryId: string,
): Promise<DeliveryOutcome> {
    const start = Date.now();
    const endpointId = String(endpoint.get('id'));

    try {
        const timestamp = Math.floor(start / 1000);
        const signature = await buildSignatureHeader(String(endpoint.get('secret')), body, timestamp);

        const response = await fetch(String(endpoint.get('url')), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SIGNATURE_HEADER]: signature,
                [EVENT_HEADER]: event,
                [DELIVERY_HEADER]: deliveryId,
                'User-Agent': 'Ottabase-Webhooks/1.0',
            },
            body,
            signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
            // Never follow a redirect: a 3xx to an internal address would turn a customer's
            // endpoint into an SSRF primitive, after the URL allowlist has already passed.
            redirect: 'manual',
        });

        return {
            endpointId,
            ok: response.ok,
            statusCode: response.status,
            error: response.ok ? null : `HTTP ${response.status}`,
            durationMs: Date.now() - start,
        };
    } catch (error) {
        return {
            endpointId,
            ok: false,
            statusCode: null,
            error: summarizeDeliveryError(error),
            durationMs: Date.now() - start,
        };
    }
}

export interface DispatchWebhookInput<Env> {
    registry: PremiumRegistry<Env>;
    env: Env;
    /** Event name, e.g. `todo.created`. Endpoints subscribe by exact name or `'*'`. */
    event: string;
    payload: unknown;
    /** Whose endpoints to notify. */
    tenant: WebhookTenant;
}

/**
 * Deliver an event to every subscribed, enabled endpoint of one tenant.
 *
 * Returns one outcome per endpoint. An unlicensed or disabled package delivers nothing
 * and returns an empty array — the caller does not have to know whether the package is
 * licensed, which is what makes `dispatchWebhookEvent` safe to call unconditionally from
 * host code.
 */
export async function dispatchWebhookEvent<Env>(input: DispatchWebhookInput<Env>): Promise<DeliveryOutcome[]> {
    const { registry, env, event, payload, tenant } = input;

    const resolution = await registry.resolve(env, WEBHOOKS_PACKAGE_KEY);
    if (!resolution || resolution.license.state === 'disabled') return [];

    // A personal scope without a user is ambiguous. Fail closed rather than widening
    // to every endpoint whose organization is null.
    if (!tenant.appId || (tenant.organizationId === null && !tenant.userId)) return [];

    const where: Record<string, unknown> = {
        enabled: true,
        appId: tenant.appId,
        organizationId: tenant.organizationId,
    };
    if (tenant.organizationId === null) where.userId = tenant.userId;

    const endpoints = (await WebhookEndpoint.where(where)) as WebhookEndpoint[];
    const subscribed = endpoints.filter((endpoint) => endpoint.subscribesTo(event));
    if (subscribed.length === 0) return [];

    // Logging is the paid half — checked ONCE per dispatch rather than per endpoint.
    const logGate = await registry.feature(env, WEBHOOKS_PACKAGE_KEY, WEBHOOKS_FEATURE_DELIVERY_LOG);

    const outcomes: DeliveryOutcome[] = [];
    for (const endpoint of subscribed) {
        const deliveryId = crypto.randomUUID();
        const body = JSON.stringify({ id: deliveryId, event, createdAt: Date.now(), data: payload });

        const outcome = await deliverToEndpoint(endpoint, event, body, deliveryId);
        outcomes.push(outcome);

        // Health on the endpoint is FREE — it is the whole observability story of the free
        // tier, and hiding it behind the licence would make an unlicensed install silently
        // undebuggable rather than merely limited.
        await endpoint.recordDelivery(outcome);

        if (logGate.allowed) {
            await WebhookDelivery.create({
                id: deliveryId,
                endpointId: outcome.endpointId,
                event,
                status: outcome.ok ? 'success' : 'failed',
                statusCode: outcome.statusCode,
                error: outcome.error,
                durationMs: outcome.durationMs,
                organizationId: tenant.organizationId,
                userId: tenant.organizationId === null ? (tenant.userId ?? null) : null,
                appId: tenant.appId,
            });
        }
    }

    return outcomes;
}
