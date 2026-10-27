'use client';

// ============================================================
// @ottabase/alerts/react: query hooks
// ============================================================
// Through the framework client (`useApiQuery` / `useApiMutation`), never `fetch()`: the
// app's one API client attaches the session, and the cache owns retries. Every mutation
// invalidates the whole `alert_events` namespace: the console is small enough that
// refetching all of it is simpler than knowing which part changed.
// ============================================================

import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { ALERTS_BASE_PATH } from '../constants';
import type {
    AlertView,
    AlertsSummary,
    ChannelInput,
    ChannelType,
    ChannelView,
    DeliveryView,
    SavedChannel,
    Severity,
} from '../types';

/** Entity namespace for query keys and invalidation. */
export const ALERTS_ENTITY = 'alert_events';

type Envelope<T> = { data: T };
const unwrap = <T>(response: Envelope<T>) => response.data;

export interface ChannelTypeInfo {
    type: ChannelType;
    label: string;
    batches: boolean;
}

export function useAlertChannels() {
    return useApiQuery<
        Envelope<{ channels: ChannelView[]; types: ChannelTypeInfo[] }>,
        { channels: ChannelView[]; types: ChannelTypeInfo[] }
    >({
        entity: ALERTS_ENTITY,
        queryKey: ['channels'],
        endpoint: `${ALERTS_BASE_PATH}/channels`,
        select: unwrap,
        queryOptions: { staleTime: 15_000 },
    });
}

export function useAlertsSummary() {
    return useApiQuery<Envelope<AlertsSummary>, AlertsSummary>({
        entity: ALERTS_ENTITY,
        queryKey: ['summary'],
        endpoint: `${ALERTS_BASE_PATH}/summary`,
        select: unwrap,
        queryOptions: { staleTime: 15_000 },
    });
}

export interface FeedQuery {
    source?: string;
    severity?: Severity;
    before?: number;
    limit?: number;
}

export function useAlertFeed(query: FeedQuery) {
    const params = new URLSearchParams({ limit: String(query.limit ?? 50) });
    if (query.source) params.set('source', query.source);
    if (query.severity) params.set('severity', query.severity);
    if (query.before) params.set('before', String(query.before));
    return useApiQuery<Envelope<AlertView[]>, AlertView[]>({
        entity: ALERTS_ENTITY,
        queryKey: ['feed', params.toString()],
        endpoint: `${ALERTS_BASE_PATH}/alerts?${params.toString()}`,
        select: unwrap,
        // The last page stays on screen while a filter change loads: no flash.
        queryOptions: { staleTime: 15_000, placeholderData: (previous) => previous },
    });
}

export interface TestOutcome {
    ok: boolean;
    error: string | null;
    delivery: DeliveryView | null;
}

/** Every write the console makes. */
export function useAlertActions() {
    const invalidateEntities = [ALERTS_ENTITY];
    const create = useApiMutation<Envelope<SavedChannel>, ChannelInput>({
        endpoint: `${ALERTS_BASE_PATH}/channels`,
        method: 'POST',
        invalidateEntities,
    });
    const update = useApiMutation<Envelope<SavedChannel>, ChannelInput & { id: string }>({
        endpoint: ({ id }) => `${ALERTS_BASE_PATH}/channels/${encodeURIComponent(id)}`,
        method: 'PATCH',
        invalidateEntities,
    });
    const remove = useApiMutation<Envelope<{ id: string; removed: boolean }>, { id: string }>({
        endpoint: ({ id }) => `${ALERTS_BASE_PATH}/channels/${encodeURIComponent(id)}`,
        method: 'DELETE',
        invalidateEntities,
    });
    const test = useApiMutation<Envelope<TestOutcome>, { id: string }>({
        endpoint: ({ id }) => `${ALERTS_BASE_PATH}/channels/${encodeURIComponent(id)}/test`,
        method: 'POST',
        invalidateEntities,
    });
    const retry = useApiMutation<Envelope<DeliveryView>, { id: string }>({
        endpoint: ({ id }) => `${ALERTS_BASE_PATH}/deliveries/${encodeURIComponent(id)}/retry`,
        method: 'POST',
        invalidateEntities,
    });
    return { create, update, remove, test, retry };
}
