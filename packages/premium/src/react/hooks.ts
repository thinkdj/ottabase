'use client';

// ============================================================
// @ottabase/premium/react — query hooks
// ============================================================
// Built on TanStack Query with the framework's `meta: { entity }` convention, so the
// app's global mutation-cache observer busts the same namespace it already owns.
//
// EVERY GATE HERE FAILS CLOSED — while loading, on error, and when rendered outside the
// provider. A convenience default that ALLOWED the action would silently lose the gate
// for any component mounted outside the tree, which is precisely the bug a paid feature
// cannot afford. These hooks are a UX affordance; the authoritative check is the
// server-side guard in `@ottabase/premium/server`.
// ============================================================

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { checkFeatureFromStatus, checkLimitFromStatus } from '../status-gates';
import { usePremiumClient } from './context';
import type { PremiumGateAnswer, PremiumPackageStatus } from '../types';

/** The entity namespace. Shared by every premium query so one invalidation busts all of them. */
export const PREMIUM_ENTITY = 'premium_packages';

export const premiumQueryKeys = {
    all: () => [PREMIUM_ENTITY] as const,
    list: () => [PREMIUM_ENTITY, 'list'] as const,
};

/** Every registered package and its live state. */
export function usePremiumPackages(queryOptions?: Partial<UseQueryOptions<PremiumPackageStatus[], Error>>) {
    const client = usePremiumClient();
    return useQuery<PremiumPackageStatus[], Error>({
        queryKey: premiumQueryKeys.list(),
        queryFn: () => client.request<PremiumPackageStatus[]>('/packages'),
        // Short, plus refetch-on-focus: a license can be activated in another tab, or
        // expire while a long-lived dashboard sits open. Mutation-driven invalidation
        // cannot catch either.
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        enabled: client.mounted,
        ...queryOptions,
    });
}

/** One package's state, or null when it is not installed. */
export function usePremiumPackage(packageKey: string) {
    const query = usePremiumPackages();
    return {
        ...query,
        data: query.data?.find((pkg) => pkg.key === packageKey) ?? null,
    };
}

/** Is the package serving at all? Use for a whole-page gate. */
export function usePremiumEnabled(packageKey: string): PremiumGateAnswer & { isLoading: boolean } {
    const client = usePremiumClient();
    const { data, isLoading } = usePremiumPackage(packageKey);

    if (!client.mounted || isLoading || !data) {
        return {
            allowed: false,
            upsell: false,
            reason: client.mounted ? 'PACKAGE_UNKNOWN' : 'PACKAGE_DISABLED',
            state: 'unlicensed',
            isLoading,
        };
    }
    return {
        allowed: data.enabled,
        upsell: !data.enabled && data.state !== 'disabled',
        reason: data.reason,
        state: data.state,
        purchaseUrl: data.purchaseUrl,
        isLoading: false,
    };
}

/** Is one paid feature unlocked? */
export function usePremiumFeature(packageKey: string, feature: string): PremiumGateAnswer & { isLoading: boolean } {
    const client = usePremiumClient();
    const { data, isLoading } = usePremiumPackage(packageKey);

    if (!client.mounted || isLoading || !data) {
        return { allowed: false, upsell: false, reason: 'PACKAGE_UNKNOWN', state: 'unlicensed', isLoading };
    }
    return { ...checkFeatureFromStatus(data, feature), isLoading: false };
}

/** Is there room for one more, given the count the caller already renders? */
export function usePremiumLimit(
    packageKey: string,
    limitKey: string,
    current: number,
): PremiumGateAnswer & { isLoading: boolean } {
    const client = usePremiumClient();
    const { data, isLoading } = usePremiumPackage(packageKey);

    if (!client.mounted || isLoading || !data) {
        return { allowed: false, upsell: false, reason: 'PACKAGE_UNKNOWN', state: 'unlicensed', isLoading };
    }
    return { ...checkLimitFromStatus(data, limitKey, current), isLoading: false };
}

/**
 * License management, with invalidation kept INTERNAL.
 *
 * Activate, remove and refresh must all bust the same namespace; missing one means an
 * operator pastes a valid key and the page keeps telling them it is unlicensed.
 */
export function usePremiumLicense() {
    const client = usePremiumClient();
    const queryClient = useQueryClient();
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: premiumQueryKeys.all() });
    const meta = { entity: PREMIUM_ENTITY };

    const activate = useMutation<PremiumPackageStatus, Error, { key: string; license: string }>({
        meta,
        mutationFn: ({ key, license }) =>
            client.request<PremiumPackageStatus>(`/packages/${encodeURIComponent(key)}/license`, {
                method: 'POST',
                body: { license },
            }),
        onSuccess: invalidate,
    });

    const remove = useMutation<PremiumPackageStatus, Error, string>({
        meta,
        mutationFn: (key) =>
            client.request<PremiumPackageStatus>(`/packages/${encodeURIComponent(key)}/license`, { method: 'DELETE' }),
        onSuccess: invalidate,
    });

    const refresh = useMutation<PremiumPackageStatus[], Error, void>({
        meta,
        mutationFn: () => client.request<PremiumPackageStatus[]>('/refresh', { method: 'POST' }),
        onSuccess: invalidate,
    });

    return { activate, remove, refresh, invalidate };
}
