'use client';

// ============================================================
// @ottabase/vault/react — query hooks
// ============================================================
// These reuse the premium provider's `requestAbsolute` seam rather than introducing a
// second client: the app's API client is what attaches the session and tenant headers, and
// one client means the entitlement gate and the data it guards answer for the same caller.
// ============================================================

import { usePremiumClient } from '@ottabase/premium/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VAULT_BASE_PATH } from '../constants';
import type { BackupManifest, RestoreResult } from '../types';

/** Entity namespace for query keys and mutation meta. */
export const VAULT_ENTITY = 'vault_backups';

export const vaultQueryKeys = {
    all: () => [VAULT_ENTITY] as const,
    list: () => [VAULT_ENTITY, 'list'] as const,
};

export function useVaultBackups() {
    const client = usePremiumClient();
    const queryClient = useQueryClient();
    const request = <T>(path: string, init?: { method?: string; body?: unknown }) =>
        client.requestAbsolute<T>(`${VAULT_BASE_PATH}${path}`, init);

    const query = useQuery<BackupManifest[], Error>({
        queryKey: vaultQueryKeys.list(),
        queryFn: () => request<BackupManifest[]>('/backups?limit=100'),
        staleTime: 15_000,
        enabled: client.mounted,
    });

    const invalidate = () => void queryClient.invalidateQueries({ queryKey: vaultQueryKeys.all() });
    const meta = { entity: VAULT_ENTITY };

    const create = useMutation<BackupManifest, Error, { label?: string }>({
        meta,
        mutationFn: (input) => request<BackupManifest>('/backups', { method: 'POST', body: input }),
        onSuccess: invalidate,
    });

    const restore = useMutation<RestoreResult, Error, { id: string; tables?: string[] }>({
        meta,
        mutationFn: ({ id, tables }) =>
            request<RestoreResult>(`/backups/${encodeURIComponent(id)}/restore`, {
                method: 'POST',
                body: { confirm: id, ...(tables ? { tables } : {}) },
            }),
        onSuccess: invalidate,
    });

    const remove = useMutation<{ id: string; removed: boolean }, Error, string>({
        meta,
        mutationFn: (id) =>
            request<{ id: string; removed: boolean }>(`/backups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: invalidate,
    });

    return { ...query, backups: query.data ?? [], create, restore, remove };
}
