'use client';

// ============================================================
// @ottabase/webhooks/react — query hooks
// ============================================================
// Through the framework client (`useApiQuery` / `useApiMutation`), never `fetch()`: the
// app's one API client attaches `X-Org-Id` and `X-App-Id`, and those headers select the
// tenant whose endpoints the server returns. Every write invalidates the whole namespace.
// ============================================================

import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { WEBHOOKS_BASE_PATH } from '../constants';
import type { WebhookDeliveryView } from '../ottaorm-models/WebhookDelivery';
import type { WebhookEndpointView } from '../ottaorm-models/WebhookEndpoint';
import type { WebhookEndpointInput } from '../types';

/** Entity namespace. Matches the model's `static entity`, so invalidation cascades. */
export const WEBHOOK_ENDPOINTS_ENTITY = 'premium_webhook_endpoints';

export const webhookQueryKeys = {
    all: () => [WEBHOOK_ENDPOINTS_ENTITY] as const,
    list: () => [WEBHOOK_ENDPOINTS_ENTITY, 'list'] as const,
    events: () => [WEBHOOK_ENDPOINTS_ENTITY, 'events'] as const,
    deliveries: (endpointId?: string) => [WEBHOOK_ENDPOINTS_ENTITY, 'deliveries', endpointId ?? 'all'] as const,
};

/** A created endpoint — the ONE response that ever carries the signing secret. */
export type CreatedWebhookEndpoint = WebhookEndpointView & { secret?: string };

type Envelope<T> = { data: T };
const unwrap = <T>(response: Envelope<T>) => response.data;
const endpointPath = ({ id }: { id: string }) => `${WEBHOOKS_BASE_PATH}/${encodeURIComponent(id)}`;

export function useWebhookEndpoints() {
    const invalidateEntities = [WEBHOOK_ENDPOINTS_ENTITY];

    const query = useApiQuery<Envelope<WebhookEndpointView[]>, WebhookEndpointView[]>({
        entity: WEBHOOK_ENDPOINTS_ENTITY,
        queryKey: ['list'],
        endpoint: `${WEBHOOKS_BASE_PATH}/`,
        select: unwrap,
        queryOptions: { staleTime: 15_000 },
    });

    const catalog = useApiQuery<Envelope<string[]>, string[]>({
        entity: WEBHOOK_ENDPOINTS_ENTITY,
        queryKey: ['events'],
        endpoint: `${WEBHOOKS_BASE_PATH}/events`,
        select: unwrap,
        // Deployment-static; refetching it on every focus is pure noise.
        queryOptions: { staleTime: 60 * 60 * 1000 },
    });

    const create = useApiMutation<Envelope<CreatedWebhookEndpoint>, WebhookEndpointInput>({
        endpoint: `${WEBHOOKS_BASE_PATH}/`,
        invalidateEntities,
    });

    const update = useApiMutation<Envelope<WebhookEndpointView>, WebhookEndpointInput & { id: string }>({
        endpoint: endpointPath,
        method: 'PATCH',
        invalidateEntities,
    });

    const remove = useApiMutation<Envelope<{ deleted: boolean; id: string }>, { id: string }>({
        endpoint: endpointPath,
        method: 'DELETE',
        invalidateEntities,
    });

    // A test writes the endpoint's health fields, so the list is genuinely stale after it.
    const test = useApiMutation<Envelope<{ ok: boolean; statusCode: number | null }>, { id: string }>({
        endpoint: (variables) => `${endpointPath(variables)}/test`,
        invalidateEntities,
    });

    return { ...query, catalog, create, update, remove, test };
}

export function useWebhookDeliveries(endpointId?: string) {
    const suffix = endpointId ? `?endpointId=${encodeURIComponent(endpointId)}` : '';

    return useApiQuery<Envelope<WebhookDeliveryView[]>, WebhookDeliveryView[]>({
        entity: WEBHOOK_ENDPOINTS_ENTITY,
        queryKey: ['deliveries', endpointId ?? 'all'],
        endpoint: `${WEBHOOKS_BASE_PATH}/deliveries${suffix}`,
        select: unwrap,
        queryOptions: { staleTime: 10_000 },
    });
}
