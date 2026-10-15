'use client';
// ============================================================
// @ottabase/flags/react — the client gate
// ============================================================
// Reads `GET <basePath>/me` through the HOST's request client (the one that attaches
// X-Org-Id / X-App-Id), so the gate and the data answer for the same tenant.
//
// EVERY GATE HERE FAILS CLOSED: while loading, on error, outside the provider. These hooks
// decide what to render; the server guards (`flags.requireFeature`) decide what happens.
// ============================================================

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { checkFeature, checkLimit } from '../entitlements';
import type { Entitlements, GateAnswer } from '../types';

export type FlagsRequest = <T>(path: string) => Promise<T>;

interface FlagsContextValue {
    basePath: string;
    request: FlagsRequest;
    mounted: boolean;
}

const FlagsContext = createContext<FlagsContextValue>({
    basePath: '/api/flags',
    request: async () => {
        throw new Error('FlagsProvider requires the host application request client.');
    },
    mounted: false,
});

export function FlagsProvider({
    children,
    basePath = '/api/flags',
    request,
}: {
    children: ReactNode;
    basePath?: string;
    /** `(path) => api<{ data: T }>(path).then((r) => r.data)` with the app's client. */
    request: FlagsRequest;
}) {
    const value = useMemo<FlagsContextValue>(() => ({ basePath, request, mounted: true }), [basePath, request]);
    return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export const FLAGS_ENTITY = 'flags';
export const flagsQueryKeys = { me: () => [FLAGS_ENTITY, 'me'] as const };

/** The caller's entitlements. */
export function usePlan(queryOptions?: Partial<UseQueryOptions<Entitlements, Error>>) {
    const client = useContext(FlagsContext);
    return useQuery<Entitlements, Error>({
        queryKey: flagsQueryKeys.me(),
        queryFn: () => client.request<Entitlements>(`${client.basePath}/me`),
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        enabled: client.mounted,
        ...queryOptions,
    });
}

const CLOSED: GateAnswer = { allowed: false, upsell: false, reason: 'NO_SUBJECT', plan: null };

export function useFeature(feature: string): GateAnswer & { isLoading: boolean } {
    const { data, isLoading } = usePlan();
    if (!data) return { ...CLOSED, isLoading };
    return { ...checkFeature(data, feature), isLoading: false };
}

export function useLimit(limitKey: string, current: number): GateAnswer & { isLoading: boolean } {
    const { data, isLoading } = usePlan();
    if (!data) return { ...CLOSED, isLoading };
    return { ...checkLimit(data, limitKey, current), isLoading: false };
}

export interface PlanGateProps {
    feature?: string;
    /** `[limitKey, current]`: renders children while there is room for one more. */
    limit?: [string, number];
    /** Rendered when the gate is closed. `null` renders nothing (right for a nav item, wrong for a page). */
    fallback?: ReactNode;
    children: ReactNode;
}

/** Renders children only when the plan allows. Fails closed while loading. */
export function PlanGate({ feature, limit, fallback = null, children }: PlanGateProps) {
    const { data } = usePlan();
    if (!data) return <>{fallback}</>;
    const featureOk = feature ? checkFeature(data, feature).allowed : true;
    const limitOk = limit ? checkLimit(data, limit[0], limit[1]).allowed : true;
    return <>{featureOk && limitOk ? children : fallback}</>;
}
