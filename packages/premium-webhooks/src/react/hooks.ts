'use client';

// ============================================================
// @ottabase/premium-webhooks/react — query hooks
// ============================================================
// These reuse the premium provider's `requestAbsolute` seam rather than introducing a
// second client: the app's API client is what attaches `X-Org-Id` and `X-App-Id`, and
// those headers select the tenant whose endpoints the server returns. Two clients would
// mean the entitlement gate and the data it guards could answer for two different
// tenants.
// ============================================================

import { usePremiumClient } from '@ottabase/premium/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useWebhookEndpoints() {
    const client = usePremiumClient();
    const queryClient = useQueryClient();

    const request = <T>(path: string, init?: { method?: string; body?: unknown }) =>
        client.requestAbsolute<T>(`${WEBHOOKS_BASE_PATH}${path}`, init);

    const query = useQuery<WebhookEndpointView[], Error>({
        queryKey: webhookQueryKeys.list(),
        queryFn: () => request<WebhookEndpointView[]>('/'),
        staleTime: 15_000,
        enabled: client.mounted,
    });

    const catalog = useQuery<string[], Error>({
        queryKey: webhookQueryKeys.events(),
        queryFn: () => request<string[]>('/events'),
        // Deployment-static; refetching it on every focus is pure noise.
        staleTime: 60 * 60 * 1000,
        enabled: client.mounted,
    });

    const invalidate = () => void queryClient.invalidateQueries({ queryKey: webhookQueryKeys.all() });
    const meta = { entity: WEBHOOK_ENDPOINTS_ENTITY };

    const create = useMutation<CreatedWebhookEndpoint, Error, WebhookEndpointInput>({
        meta,
        mutationFn: (input) => request<CreatedWebhookEndpoint>('/', { method: 'POST', body: input }),
        onSuccess: invalidate,
    });

    const update = useMutation<WebhookEndpointView, Error, { id: string; data: WebhookEndpointInput }>({
        meta,
        mutationFn: ({ id, data }) =>
            request<WebhookEndpointView>(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
        onSuccess: invalidate,
    });

    const remove = useMutation<{ deleted: boolean; id: string }, Error, string>({
        meta,
        mutationFn: (id) =>
            request<{ deleted: boolean; id: string }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: invalidate,
    });

    const test = useMutation<{ ok: boolean; statusCode: number | null }, Error, string>({
        meta,
        mutationFn: (id) =>
            request<{ ok: boolean; statusCode: number | null }>(`/${encodeURIComponent(id)}/test`, { method: 'POST' }),
        // A test writes the endpoint's health fields, so the list is genuinely stale after it.
        onSuccess: invalidate,
    });

    return { ...query, catalog, create, update, remove, test, invalidate };
}

export function useWebhookDeliveries(endpointId?: string) {
    const client = usePremiumClient();
    const suffix = endpointId ? `?endpointId=${encodeURIComponent(endpointId)}` : '';

    return useQuery<WebhookDeliveryView[], Error>({
        queryKey: webhookQueryKeys.deliveries(endpointId),
        queryFn: () => client.requestAbsolute<WebhookDeliveryView[]>(`${WEBHOOKS_BASE_PATH}/deliveries${suffix}`),
        staleTime: 10_000,
        enabled: client.mounted,
    });
}
