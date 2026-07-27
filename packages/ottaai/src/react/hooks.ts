'use client';

// ============================================================
// @ottabase/ottaai/react — query hooks
// ============================================================
// Built on TanStack Query with the framework's `meta: { entity }` convention, so
// the app's global mutation-cache observer busts the same namespace it already
// owns. Building query hooks by hand WITHOUT that tag fights the query keys the
// app already has.
// ============================================================

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { AiStatus } from '../resolver';
import type { GateAnswer } from '../tasks';
import type { CredentialView } from '../types';
import type { VerifyResult } from '../resolver/verify';
import { useAiProvisioningConfig } from './context';

/** The entity namespace. Matches the model's `static entity`, so invalidation cascades. */
export const AI_CREDENTIALS_ENTITY = 'ai_provider_credentials';

export const aiQueryKeys = {
    all: () => [AI_CREDENTIALS_ENTITY] as const,
    list: () => [AI_CREDENTIALS_ENTITY, 'list'] as const,
    status: () => [AI_CREDENTIALS_ENTITY, 'status'] as const,
    providers: () => [AI_CREDENTIALS_ENTITY, 'providers'] as const,
};

export interface ProviderOption {
    id: string;
    displayName: string;
    requiresKey: boolean;
    keyFormatHint: string | null;
    docsUrl: string | null;
    allowCustomModel: boolean;
    models: Array<{ id: string; label: string }>;
}

export interface SaveCredentialInput {
    /** Which tenancy rung to create at. The VALUES come from the server's context. */
    scope?: 'user' | 'organization';
    label?: string | null;
    provider?: string;
    model?: string | null;
    /** Plaintext. Leave undefined or blank on an edit to KEEP the stored key. */
    secret?: string;
    alias?: string;
    enabled?: boolean;
    /** Explicit transition to "no secret". Blank means keep, so this is the only way to clear. */
    clearSecret?: boolean;
}

export function useAiProviders(queryOptions?: Partial<UseQueryOptions<ProviderOption[], Error>>) {
    const config = useAiProvisioningConfig();
    return useQuery<ProviderOption[], Error>({
        queryKey: aiQueryKeys.providers(),
        queryFn: () => config.request<ProviderOption[]>('/providers'),
        // The registry is deployment-static; no point refetching it.
        staleTime: 60 * 60 * 1000,
        ...queryOptions,
    });
}

/**
 * The status primitive.
 *
 * TWO FAIL-CLOSED RULES:
 *  • "not loaded yet" is treated as NOT configured (the cost-safe direction);
 *  • a SHORT stale time plus refetch-on-focus, because mutation-driven invalidation
 *    cannot catch the cross-tab or out-of-band case — a user creates a key in the
 *    provider console or a second tab, comes back, and the gate would stay closed.
 */
export function useAiStatus(queryOptions?: Partial<UseQueryOptions<AiStatus, Error>>) {
    const config = useAiProvisioningConfig();
    return useQuery<AiStatus, Error>({
        queryKey: aiQueryKeys.status(),
        queryFn: () => config.request<AiStatus>('/status'),
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        ...queryOptions,
    });
}

/**
 * Credentials plus every mutation, so INVALIDATION IS INTERNAL.
 *
 * Save, activate, enable, disable and delete must ALL bust the status cache; missing one
 * means a user connects a key and stays blocked until reload.
 */
export function useAiCredentials() {
    const config = useAiProvisioningConfig();
    const queryClient = useQueryClient();

    const query = useQuery<CredentialView[], Error>({
        queryKey: aiQueryKeys.list(),
        queryFn: () => config.request<CredentialView[]>('/credentials'),
        staleTime: 15_000,
        refetchOnWindowFocus: true,
    });

    const invalidate = () => {
        // One prefixed key busts list + status + anything else in the namespace.
        void queryClient.invalidateQueries({ queryKey: aiQueryKeys.all() });
    };

    const meta = { entity: AI_CREDENTIALS_ENTITY };

    const create = useMutation<CredentialView, Error, SaveCredentialInput>({
        meta,
        mutationFn: (input) => config.request<CredentialView>('/credentials', { method: 'POST', body: input }),
        onSuccess: invalidate,
    });

    const update = useMutation<CredentialView, Error, { id: string; data: SaveCredentialInput }>({
        meta,
        mutationFn: ({ id, data }) =>
            config.request<CredentialView>(`/credentials/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: data,
            }),
        onSuccess: invalidate,
    });

    const remove = useMutation<{ deleted: boolean; id: string }, Error, string>({
        meta,
        mutationFn: (id) =>
            config.request<{ deleted: boolean; id: string }>(`/credentials/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            }),
        onSuccess: invalidate,
    });

    const activate = useMutation<CredentialView, Error, string>({
        meta,
        mutationFn: (id) =>
            config.request<CredentialView>(`/credentials/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
        onSuccess: invalidate,
    });

    const test = useMutation<
        VerifyResult,
        Error,
        { credentialId: string } | { provider: string; model?: string | null; secret: string }
    >({
        // Deliberately NOT tagged with `meta.entity`: testing a key mutates nothing, and
        // busting the list on every Test click would refetch for no reason.
        mutationFn: (input) => config.request<VerifyResult>('/credentials/test', { method: 'POST', body: input }),
    });

    return { ...query, create, update, remove, activate, test, invalidate };
}

/**
 * The client-side gate.
 *
 * A UX AFFORDANCE LAYERED ON SERVER TRUTH — the authoritative check is `requireByok` on
 * the route, implemented by the SAME resolver, so guard and runtime cannot drift. A gate
 * enforced only in the browser stops nobody with a fetch call.
 *
 * Fails closed while loading, and fails closed when rendered outside the provider: a
 * convenience no-op that ALLOWED the action would silently lose the gate for any component
 * mounted outside the tree.
 */
export function useAiGate(taskKey: string): GateAnswer & { isLoading: boolean } {
    const config = useAiProvisioningConfig();
    const { data, isLoading } = useAiStatus({ enabled: config.mounted });

    const answer = data?.gates?.[taskKey];
    if (!config.mounted || isLoading || !answer) {
        return {
            allowed: false,
            upsell: true,
            gate: 'required',
            source: null,
            reason: config.mounted ? 'LOADING' : 'NO_PROVIDER',
            isLoading,
        };
    }
    return { ...answer, isLoading: false };
}
